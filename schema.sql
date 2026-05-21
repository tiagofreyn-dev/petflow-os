-- =============================================================
-- SCHEMA SQL PARA SUPABASE - PETFLOW OS (PASTA ISOLADA / SCHEMA)
-- Copie e cole no Editor SQL (SQL Editor) do seu projeto "Nile Site".
-- Isso criará uma estrutura 100% isolada e sem conflito de tabelas!
-- =============================================================

-- 1. CRIAR A "PASTA SEPARADA" (SCHEMA POSTGRES)
CREATE SCHEMA IF NOT EXISTS petflow;

-- 2. TABELA DE CLIENTES (TUTORES) NO SCHEMA petflow
CREATE TABLE IF NOT EXISTS petflow.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS) para proteção
ALTER TABLE petflow.customers ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso livre de leitura/escrita para o App do CRM (Ajustar antes de escalar comercialmente)
DROP POLICY IF EXISTS "Acesso total livre CRM" ON petflow.customers;
CREATE POLICY "Acesso total livre CRM" 
ON petflow.customers FOR ALL 
USING (true) 
WITH CHECK (true);


-- 3. TABELA DE PETS NO SCHEMA petflow
CREATE TABLE IF NOT EXISTS petflow.pets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES petflow.customers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    breed TEXT NOT NULL,
    size TEXT NOT NULL CHECK (size IN ('Mini', 'Pequeno', 'Médio', 'Grande', 'Gigante')),
    coat_type TEXT NOT NULL,
    frequency_days INTEGER NOT NULL DEFAULT 15,
    last_service_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'alert', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE petflow.pets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total livre CRM" ON petflow.pets;
CREATE POLICY "Acesso total livre CRM" 
ON petflow.pets FOR ALL 
USING (true) 
WITH CHECK (true);

-- Índices de performance no schema petflow
CREATE INDEX IF NOT EXISTS idx_pets_customer_id ON petflow.pets(customer_id);
CREATE INDEX IF NOT EXISTS idx_pets_status ON petflow.pets(status);
CREATE INDEX IF NOT EXISTS idx_pets_name_breed ON petflow.pets(name, breed);


-- 4. TABELA DE LOGS DE AUTOMAÇÃO NO SCHEMA petflow
CREATE TABLE IF NOT EXISTS petflow.automations_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id UUID NOT NULL REFERENCES petflow.pets(id) ON DELETE CASCADE,
    message_type TEXT NOT NULL CHECK (message_type IN ('banho', 'vacina', 'sumido', 'cadastro', 'banho_concluido', 'resgate_resposta')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Enviado', 'Respondido')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


ALTER TABLE petflow.automations_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acesso total livre CRM" ON petflow.automations_logs;
CREATE POLICY "Acesso total livre CRM" 
ON petflow.automations_logs FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_logs_pet_id ON petflow.automations_logs(pet_id);
CREATE INDEX IF NOT EXISTS idx_logs_sent_at ON petflow.automations_logs(sent_at);


-- =============================================================
-- EXEMPLO DE CARGA INICIAL DE TESTES (SEED NO SCHEMA petflow)
-- Descomente o bloco abaixo para povoar o banco após rodar o SQL!
-- =============================================================

/*
-- 1. Inserir Tutores de Teste
INSERT INTO petflow.customers (id, name, whatsapp, address) VALUES
('11111111-1111-1111-1111-111111111111', 'Tiago de Souza', '(11) 98765-4321', 'Rua das Palmeiras, 452 - Ap 42'),
('22222222-2222-2222-2222-222222222222', 'Ana Maria Braga', '(21) 99888-7766', 'Av. Atlântica, 1024 - Copacabana'),
('33333333-3333-3333-3333-333333333333', 'Juliana Costa Lima', '(11) 97555-4433', 'Al. Lorena, 1500 - Cerqueira César');

-- 2. Inserir Pets de Teste
INSERT INTO petflow.pets (id, customer_id, name, breed, size, coat_type, frequency_days, last_service_date, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Floquinho', 'Shih Tzu', 'Pequeno', 'Longa Lisa', 7, CURRENT_DATE - INTERVAL '5 days', 'active'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Mel', 'Golden Retriever', 'Grande', 'Média', 15, CURRENT_DATE - INTERVAL '13 days', 'alert'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'Cacau', 'Cocker Spaniel', 'Médio', 'Média', 30, CURRENT_DATE - INTERVAL '49 days', 'inactive');

-- 3. Inserir Logs de Teste
INSERT INTO petflow.automations_logs (pet_id, message_type, sent_at, status) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cadastro', NOW() - INTERVAL '5 days', 'Respondido'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'banho', NOW() - INTERVAL '13 days', 'Respondido'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'sumido', NOW() - INTERVAL '4 days', 'Enviado');
*/
