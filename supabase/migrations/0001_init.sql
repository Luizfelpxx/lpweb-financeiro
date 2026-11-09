-- =============================================================================
-- LPweb.dev | Assessoria Financeira — esquema inicial
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma única vez).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.indicado_por_tipo as enum ('geize', 'rosangela');
create type public.status_pagamento_tipo as enum ('aberta', 'paga');
create type public.acao_historico_tipo as enum (
  'criar', 'editar', 'excluir', 'marcar_paga', 'desmarcar_paga', 'arquivar', 'desarquivar'
);

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.clientes (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (length(btrim(nome)) > 0),
  telefone      text not null,
  cpf           text,
  endereco      text,
  observacoes   text,
  indicado_por  public.indicado_por_tipo,           -- 'geize', 'rosangela' ou null
  arquivado     boolean not null default false,     -- "arquivar" no lugar de excluir
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.emprestimos (
  id                     uuid primary key default gen_random_uuid(),
  cliente_id             uuid not null references public.clientes (id) on delete restrict,
  valor_emprestado       numeric(12, 2) not null check (valor_emprestado > 0),   -- valor "pegou"
  -- 1 a 24 parcelas mensais; 30 = "30 dias" (pagamento único)
  numero_parcelas        integer not null check (numero_parcelas between 1 and 24 or numero_parcelas = 30),
  valor_parcela          numeric(12, 2) not null check (valor_parcela > 0),
  total_a_pagar          numeric(12, 2) not null check (total_a_pagar > 0),      -- soma das parcelas
  primeiro_vencimento    date not null,
  taxa_juros_percentual  numeric(8, 2) not null,    -- (total - emprestado) / emprestado * 100
  comissao               numeric(12, 2) not null default 0 check (comissao >= 0),
  -- data em que o empréstimo foi concedido (base do relatório mensal de comissões)
  data_emprestimo        date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);
create index emprestimos_cliente_idx on public.emprestimos (cliente_id);
create index emprestimos_data_idx on public.emprestimos (data_emprestimo);

create table public.parcelas (
  id               uuid primary key default gen_random_uuid(),
  emprestimo_id    uuid not null references public.emprestimos (id) on delete cascade,
  numero_parcela   integer not null check (numero_parcela > 0),
  valor            numeric(12, 2) not null check (valor > 0),
  data_vencimento  date not null,
  status_pagamento public.status_pagamento_tipo not null default 'aberta',
  data_pagamento   date,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (emprestimo_id, numero_parcela),
  -- paga <=> tem data de pagamento
  check ((status_pagamento = 'paga') = (data_pagamento is not null))
);
create index parcelas_emprestimo_idx on public.parcelas (emprestimo_id);
create index parcelas_vencimento_idx on public.parcelas (data_vencimento);
create index parcelas_abertas_idx on public.parcelas (data_vencimento) where status_pagamento = 'aberta';

-- O status de cobrança (em_aberto / atrasada / dívida) NÃO é gravado:
-- é calculado pela aplicação com a data de hoje (America/Sao_Paulo).

create table public.historico (
  id           uuid primary key default gen_random_uuid(),
  tabela       text not null check (tabela in ('clientes', 'emprestimos', 'parcelas')),
  registro_id  uuid not null,
  cliente_id   uuid,                                -- facilita o "histórico do cliente"
  acao         public.acao_historico_tipo not null,
  dados_antes  jsonb,
  dados_depois jsonb,
  usuario_id   uuid,
  criado_em    timestamptz not null default now()
);
create index historico_criado_idx on public.historico (criado_em desc);
create index historico_cliente_idx on public.historico (cliente_id, criado_em desc);

-- Linha única de configurações.
create table public.configuracoes (
  id               smallint primary key default 1 check (id = 1),
  telegram_chat_id text,
  hora_relatorio   time not null default '08:00',   -- horário de Brasília
  atualizado_em    timestamptz not null default now()
);
insert into public.configuracoes (id) values (1);

-- ---------------------------------------------------------------------------
-- atualizado_em automático
-- ---------------------------------------------------------------------------
create function public.definir_atualizado_em() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create trigger clientes_atualizado_em before update on public.clientes
  for each row execute function public.definir_atualizado_em();
create trigger emprestimos_atualizado_em before update on public.emprestimos
  for each row execute function public.definir_atualizado_em();
create trigger parcelas_atualizado_em before update on public.parcelas
  for each row execute function public.definir_atualizado_em();
create trigger configuracoes_atualizado_em before update on public.configuracoes
  for each row execute function public.definir_atualizado_em();

-- ---------------------------------------------------------------------------
-- Histórico: toda alteração em clientes, empréstimos e parcelas
-- (gatilho com SECURITY DEFINER: o usuário logado não consegue escrever nem
-- apagar o histórico diretamente)
-- ---------------------------------------------------------------------------
create function public.registrar_historico() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_acao    public.acao_historico_tipo;
  v_antes   jsonb;
  v_depois  jsonb;
  v_id      uuid;
  v_cliente uuid;
begin
  if tg_op = 'INSERT' then
    v_acao := 'criar';
    v_depois := to_jsonb(new);
    v_id := new.id;
  elsif tg_op = 'DELETE' then
    v_acao := 'excluir';
    v_antes := to_jsonb(old);
    v_id := old.id;
  else
    v_antes := to_jsonb(old);
    v_depois := to_jsonb(new);
    v_id := new.id;
    -- atualização sem mudança real (só atualizado_em) não gera histórico
    if (v_antes - 'atualizado_em') = (v_depois - 'atualizado_em') then
      return null;
    end if;
    -- (comparamos via jsonb porque o PL/pgSQL não garante curto-circuito entre tabelas)
    if tg_table_name = 'parcelas'
       and (v_antes ->> 'status_pagamento') is distinct from (v_depois ->> 'status_pagamento') then
      v_acao := case when v_depois ->> 'status_pagamento' = 'paga' then 'marcar_paga' else 'desmarcar_paga' end;
    elsif tg_table_name = 'clientes'
       and (v_antes ->> 'arquivado') is distinct from (v_depois ->> 'arquivado') then
      v_acao := case when (v_depois ->> 'arquivado')::boolean then 'arquivar' else 'desarquivar' end;
    else
      v_acao := 'editar';
    end if;
  end if;

  if tg_table_name = 'clientes' then
    v_cliente := v_id;
  elsif tg_table_name = 'emprestimos' then
    v_cliente := coalesce(v_depois ->> 'cliente_id', v_antes ->> 'cliente_id')::uuid;
  else
    select e.cliente_id into v_cliente
      from public.emprestimos e
     where e.id = coalesce(v_depois ->> 'emprestimo_id', v_antes ->> 'emprestimo_id')::uuid;
  end if;

  insert into public.historico (tabela, registro_id, cliente_id, acao, dados_antes, dados_depois, usuario_id)
  values (tg_table_name, v_id, v_cliente, v_acao, v_antes, v_depois, auth.uid());

  return null;
end $$;

create trigger clientes_historico after insert or update or delete on public.clientes
  for each row execute function public.registrar_historico();
create trigger emprestimos_historico after insert or update or delete on public.emprestimos
  for each row execute function public.registrar_historico();
create trigger parcelas_historico after insert or update or delete on public.parcelas
  for each row execute function public.registrar_historico();

-- ---------------------------------------------------------------------------
-- Não permitir excluir cliente com empréstimos ativos (só arquivar)
-- ---------------------------------------------------------------------------
create function public.bloquear_exclusao_cliente_ativo() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1
      from public.emprestimos e
      join public.parcelas p on p.emprestimo_id = e.id
     where e.cliente_id = old.id and p.status_pagamento = 'aberta'
  ) then
    raise exception 'Cliente com empréstimos ativos não pode ser excluído. Arquive o cadastro.';
  end if;
  return old;
end $$;

create trigger clientes_bloquear_exclusao before delete on public.clientes
  for each row execute function public.bloquear_exclusao_cliente_ativo();

-- ---------------------------------------------------------------------------
-- Criação atômica de empréstimo + parcelas (os cálculos vêm da aplicação)
-- SECURITY INVOKER: respeita o RLS do usuário que chamou.
-- ---------------------------------------------------------------------------
create function public.criar_emprestimo(p_emprestimo jsonb, p_parcelas jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_id uuid;
begin
  insert into public.emprestimos (
    cliente_id, valor_emprestado, numero_parcelas, valor_parcela, total_a_pagar,
    primeiro_vencimento, taxa_juros_percentual, comissao, data_emprestimo
  )
  values (
    (p_emprestimo ->> 'cliente_id')::uuid,
    (p_emprestimo ->> 'valor_emprestado')::numeric,
    (p_emprestimo ->> 'numero_parcelas')::integer,
    (p_emprestimo ->> 'valor_parcela')::numeric,
    (p_emprestimo ->> 'total_a_pagar')::numeric,
    (p_emprestimo ->> 'primeiro_vencimento')::date,
    (p_emprestimo ->> 'taxa_juros_percentual')::numeric,
    coalesce((p_emprestimo ->> 'comissao')::numeric, 0),
    coalesce((p_emprestimo ->> 'data_emprestimo')::date, (now() at time zone 'America/Sao_Paulo')::date)
  )
  returning id into v_id;

  insert into public.parcelas (emprestimo_id, numero_parcela, valor, data_vencimento, status_pagamento, data_pagamento)
  select v_id,
         (x ->> 'numero_parcela')::integer,
         (x ->> 'valor')::numeric,
         (x ->> 'data_vencimento')::date,
         coalesce(x ->> 'status_pagamento', 'aberta')::public.status_pagamento_tipo,
         nullif(x ->> 'data_pagamento', '')::date
    from jsonb_array_elements(p_parcelas) as x;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Segurança: RLS em TODAS as tabelas; apenas usuários autenticados
-- (desative o cadastro público em Authentication > Providers > Email)
-- ---------------------------------------------------------------------------
alter table public.clientes      enable row level security;
alter table public.emprestimos   enable row level security;
alter table public.parcelas      enable row level security;
alter table public.historico     enable row level security;
alter table public.configuracoes enable row level security;

create policy "autenticado acessa clientes" on public.clientes
  for all to authenticated using (true) with check (true);
create policy "autenticado acessa emprestimos" on public.emprestimos
  for all to authenticated using (true) with check (true);
create policy "autenticado acessa parcelas" on public.parcelas
  for all to authenticated using (true) with check (true);
create policy "autenticado acessa configuracoes" on public.configuracoes
  for all to authenticated using (true) with check (true);
-- histórico: somente leitura (escrita apenas pelo gatilho SECURITY DEFINER)
create policy "autenticado le historico" on public.historico
  for select to authenticated using (true);

-- Camada extra de proteção nas permissões das tabelas
revoke all on public.clientes, public.emprestimos, public.parcelas,
              public.historico, public.configuracoes from anon;
revoke insert, update, delete, truncate on public.historico from authenticated;

revoke execute on function public.criar_emprestimo(jsonb, jsonb) from public, anon;
grant execute on function public.criar_emprestimo(jsonb, jsonb) to authenticated;
