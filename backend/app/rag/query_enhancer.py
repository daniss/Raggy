"""Query enhancement module for improving search queries."""

import logging
from typing import List, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)


class QueryEnhancer:
    """Enhances user queries for better retrieval."""
    
    def __init__(self):
        self.enabled = getattr(settings, 'USE_QUERY_ENHANCEMENT', False)
        logger.info(f"Query enhancement {'enabled' if self.enabled else 'disabled'}")
    
    def enhance_query(self, query: str, context: Optional[str] = None) -> List[str]:
        """
        Enhance a user query by generating multiple variations.
        
        Args:
            query: Original user query
            context: Optional context for better enhancement
            
        Returns:
            List of enhanced query variations (includes original)
        """
        if not self.enabled:
            return [query]
        
        try:
            enhanced_queries = [query]  # Always include original
            
            # Simple query enhancements (for now, just return original)
            # In a full implementation, this could use LLMs to generate
            # synonyms, rephrasings, and contextual variations
            
            # Add some basic variations if query is long enough
            if len(query.split()) > 2:
                # Remove stop words version (simplified)
                stop_words = {'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'à', 'dans', 'pour', 'avec', 'par', 'sur', 'sous'}
                words = query.lower().split()
                filtered_words = [w for w in words if w not in stop_words]
                if len(filtered_words) >= 2:
                    enhanced_queries.append(' '.join(filtered_words))
            
            logger.debug(f"Enhanced query '{query}' into {len(enhanced_queries)} variations")
            return enhanced_queries
            
        except Exception as e:
            logger.warning(f"Query enhancement failed: {e}, using original query")
            return [query]


# Global instance
query_enhancer = QueryEnhancer()