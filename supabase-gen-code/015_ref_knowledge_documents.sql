-- ============================================================
-- 015_ref_knowledge_documents.sql
-- Registry of documents ingested into the Dify RAG knowledge base
-- Does NOT store the documents or embeddings — those live in Dify/FAISS
-- Metadata tags here must exactly match the tags set in Dify
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_knowledge_documents (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_name   text        NOT NULL UNIQUE,
    topic_category  text        CHECK (topic_category IN (
                                    'pest','irrigation','soil','market',
                                    'crop_planning','weather','general'
                                )),
    region_tag      text,
    crop_tag        text,
    season_tag      text        CHECK (season_tag IN ('kharif','rabi','zaid','all')),
    ingested_at     timestamptz,
    chunk_count     integer     CHECK (chunk_count > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ref_knowledge_documents_topic_category
    ON ref_knowledge_documents (topic_category);

CREATE INDEX IF NOT EXISTS idx_ref_knowledge_documents_region_tag
    ON ref_knowledge_documents (region_tag);

-- RLS
ALTER TABLE ref_knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_knowledge_documents_select_authenticated"
    ON ref_knowledge_documents FOR SELECT
    TO authenticated
    USING (true);
