from config import settings

import logging
logger = logging.getLogger(__name__)

# Initialize singletons to avoid reloading on every request
_qclient = None
_embedder = None

def get_qdrant_client():
    global _qclient
    if not settings.qdrant_direct_search_enabled:
        return None

    if _qclient is None and settings.qdrant_url and settings.qdrant_api_key:
        try:
            from qdrant_client import QdrantClient
            _qclient = QdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key,
                check_compatibility=False,
            )
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
    return _qclient

def get_embedder():
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            # Do not download models at request time. If the embedding model is
            # not already cached locally, skip direct Qdrant enrichment and let
            # Dify's own knowledge retrieval handle RAG.
            _embedder = SentenceTransformer('all-MiniLM-L6-v2', local_files_only=True)
        except Exception as e:
            logger.error(f"Failed to load sentence-transformers: {e}")
    return _embedder

async def search_knowledge_base(query: str, top_k: int = 3) -> list[str]:
    """
    Embeds the user query and searches the 'krishi-sakhi' collection.
    Returns a list of payload texts.
    """
    client = get_qdrant_client()
    if not client:
        return []

    embedder = get_embedder()
    if not embedder:
        return []
        
    try:
        # Embed query
        vec = embedder.encode(query).tolist()
        
        # Search Qdrant
        hits = client.query_points(
            collection_name="krishi-sakhi",
            query=vec,
            limit=top_k
        ).points
        
        results = []
        for hit in hits:
            content = hit.payload.get('page_content', '')
            if content:
                results.append(content)
                
        return results
    except Exception as e:
        logger.error(f"Qdrant Search Error: {e}")
        return []
