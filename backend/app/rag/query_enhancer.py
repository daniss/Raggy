"""Query enhancement module for improving RAG retrieval with French language support."""

import logging
from typing import List, Dict, Any, Optional, Set
import re
from dataclasses import dataclass
import asyncio
from groq import Groq
from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EnhancedQuery:
    """Enhanced query with multiple variations."""
    original: str
    expanded: List[str]
    synonyms: List[str]
    multi_queries: List[str]
    enhanced_score: float = 0.0


class FrenchQueryEnhancer:
    """Query enhancer specialized for French language queries."""
    
    def __init__(self):
        """Initialize French query enhancer."""
        # French synonyms and variations for common food/meal terms
        self.french_synonyms = {
            'repas': ['repas', 'plat', 'menu', 'nourriture', 'alimentation'],
            'petit-déjeuner': ['petit-déjeuner', 'petit déjeuner', 'pdj', 'breakfast'],
            'déjeuner': ['déjeuner', 'lunch', 'dîner de midi', 'repas de midi'],
            'dîner': ['dîner', 'souper', 'repas du soir', 'dinner'],
            'recette': ['recette', 'préparation', 'cuisson', 'cuisine'],
            'ingrédients': ['ingrédients', 'ingrédient', 'composants', 'éléments'],
            'instructions': ['instructions', 'étapes', 'préparation', 'méthode'],
            'temps': ['temps', 'durée', 'minute', 'minutes', 'heure', 'heures'],
            'nutrition': ['nutrition', 'nutritionnel', 'santé', 'équilibré'],
            'régime': ['régime', 'diet', 'alimentaire', 'diététique'],
        }
        
        # French grammatical variations
        self.french_variations = {
            # Plural/singular
            'patterns': [
                (r'(\w+)s$', r'\1'),  # Remove plural 's'
                (r'(\w+)x$', r'\1'),  # Remove plural 'x'
                (r'(\w+)$', r'\1s'),  # Add plural 's'
            ],
            # Common French word endings and their variations
            'endings': {
                'tion': ['tion', 'sion'],
                'ment': ['ment', 'ement'],
                'eur': ['eur', 'euse'],
                'er': ['er', 'é', 'ée'],
            }
        }
        
        # French question patterns
        self.french_questions = [
            "Qu'est-ce que {}?",
            "Comment {}?",
            "Pourquoi {}?",
            "Quand {}?",
            "Où {}?",
            "Que contient {}?",
            "Comment préparer {}?",
            "Quels sont les ingrédients de {}?",
        ]
        
        # Initialize Groq client for LLM-based enhancement
        self.groq_client = Groq(api_key=settings.groq_api_key)
        self.model = settings.groq_model
    
    def _extract_key_terms(self, query: str) -> List[str]:
        """Extract key terms from the query."""
        # Remove common French stop words and punctuation
        stop_words = {
            'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'à', 'au', 
            'avec', 'pour', 'sur', 'dans', 'par', 'sans', 'sous', 'est', 'sont', 'que',
            'qui', 'quoi', 'comment', 'pourquoi', 'quand', 'où', 'quel', 'quelle'
        }
        
        # Clean and tokenize
        clean_query = re.sub(r'[^\w\s\-àâäéèêëïîôöùûüÿç]', ' ', query.lower())
        terms = [term.strip() for term in clean_query.split() if term.strip()]
        
        # Filter out stop words and short terms
        key_terms = [term for term in terms if term not in stop_words and len(term) > 2]
        
        return key_terms
    
    def _generate_synonyms(self, terms: List[str]) -> List[str]:
        """Generate synonyms for key terms."""
        synonyms = set()
        
        for term in terms:
            # Direct synonym lookup
            if term in self.french_synonyms:
                synonyms.update(self.french_synonyms[term])
            
            # Check if term contains known synonymous words
            for key, syns in self.french_synonyms.items():
                if key in term or term in key:
                    synonyms.update(syns)
        
        return list(synonyms)
    
    def _generate_variations(self, terms: List[str]) -> List[str]:
        """Generate grammatical variations of terms."""
        variations = set()
        
        for term in terms:
            # Add original term
            variations.add(term)
            
            # Apply pattern-based variations
            for pattern, replacement in self.french_variations['patterns']:
                if re.match(pattern, term):
                    variant = re.sub(pattern, replacement, term)
                    if variant != term:
                        variations.add(variant)
            
            # Apply ending-based variations
            for ending, variants in self.french_variations['endings'].items():
                if term.endswith(ending):
                    for variant_ending in variants:
                        if variant_ending != ending:
                            variant = term[:-len(ending)] + variant_ending
                            variations.add(variant)
        
        return list(variations)
    
    def _expand_query(self, query: str, key_terms: List[str]) -> List[str]:
        """Expand the original query with additional context."""
        expanded_queries = []
        
        # Add domain-specific context
        domain_contexts = [
            f"Dans le contexte de la nutrition: {query}",
            f"Concernant l'alimentation: {query}",
            f"À propos des repas: {query}",
            f"Pour la cuisine: {query}",
        ]
        
        # Add expanded queries based on key terms
        for term in key_terms[:3]:  # Limit to top 3 terms
            if term in self.french_synonyms:
                expanded_queries.append(f"{query} {' '.join(self.french_synonyms[term][:2])}")
        
        # Add contextual questions
        main_term = key_terms[0] if key_terms else query
        for pattern in self.french_questions[:3]:  # Use first 3 patterns
            expanded_queries.append(pattern.format(main_term))
        
        return expanded_queries + domain_contexts
    
    async def _llm_enhance_query(self, query: str) -> List[str]:
        """Use LLM to generate enhanced queries."""
        try:
            prompt = f"""Tu es un expert en recherche d'information. Pour la question suivante, génère 3 reformulations qui aideraient à trouver des informations pertinentes dans une base de documents français sur la nutrition et l'alimentation.

Question originale: {query}

Génère 3 reformulations différentes, une par ligne, sans numérotation:
1. Une version plus détaillée
2. Une version avec des synonymes
3. Une version avec un angle différent

Reformulations:"""

            response = self.groq_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=200
            )
            
            # Parse response
            enhanced_queries = []
            lines = response.choices[0].message.content.strip().split('\n')
            
            for line in lines:
                line = line.strip()
                if line and not line.startswith(('1.', '2.', '3.', '-', '*')):
                    # Remove leading numbers or bullets
                    clean_line = re.sub(r'^\d+\.\s*', '', line)
                    clean_line = re.sub(r'^[-*]\s*', '', clean_line)
                    if clean_line and clean_line != query:
                        enhanced_queries.append(clean_line)
            
            logger.debug(f"LLM generated {len(enhanced_queries)} enhanced queries")
            return enhanced_queries[:3]  # Limit to 3
            
        except Exception as e:
            logger.warning(f"LLM query enhancement failed: {e}")
            return []
    
    def _generate_multi_queries(self, query: str, key_terms: List[str]) -> List[str]:
        """Generate multiple focused queries from the original."""
        multi_queries = []
        
        # Split compound questions
        if ' et ' in query or ' ou ' in query:
            parts = re.split(r' et | ou ', query)
            multi_queries.extend([part.strip() for part in parts if part.strip()])
        
        # Generate term-specific queries
        for term in key_terms[:2]:  # Limit to 2 main terms
            multi_queries.append(f"Informations sur {term}")
            multi_queries.append(f"Tout à propos de {term}")
        
        # Generate aspect-specific queries
        aspects = ['ingrédients', 'préparation', 'nutrition', 'temps', 'méthode']
        for aspect in aspects:
            if aspect.lower() not in query.lower():
                multi_queries.append(f"{query} {aspect}")
        
        return multi_queries[:5]  # Limit to 5
    
    async def enhance_query(self, query: str) -> EnhancedQuery:
        """Enhance a query with multiple techniques.
        
        Args:
            query: Original query to enhance
            
        Returns:
            EnhancedQuery object with various enhancements
        """
        try:
            logger.debug(f"Enhancing query: {query}")
            
            # Extract key terms
            key_terms = self._extract_key_terms(query)
            logger.debug(f"Extracted key terms: {key_terms}")
            
            # Generate various enhancements
            synonyms = self._generate_synonyms(key_terms)
            variations = self._generate_variations(key_terms)
            expanded = self._expand_query(query, key_terms)
            multi_queries = self._generate_multi_queries(query, key_terms)
            
            # Get LLM enhancements
            llm_enhanced = await self._llm_enhance_query(query)
            expanded.extend(llm_enhanced)
            
            # Remove duplicates and filter
            synonyms = list(set(synonyms))[:10]  # Limit to 10
            expanded = list(set(expanded))[:8]   # Limit to 8
            multi_queries = list(set(multi_queries))[:5]  # Limit to 5
            
            enhanced = EnhancedQuery(
                original=query,
                expanded=expanded,
                synonyms=synonyms,
                multi_queries=multi_queries,
                enhanced_score=1.0  # Base score
            )
            
            logger.info(f"Enhanced query with {len(expanded)} expansions, "
                       f"{len(synonyms)} synonyms, {len(multi_queries)} multi-queries")
            
            return enhanced
            
        except Exception as e:
            logger.error(f"Query enhancement failed: {e}")
            # Return minimal enhancement
            return EnhancedQuery(
                original=query,
                expanded=[query],
                synonyms=[],
                multi_queries=[query],
                enhanced_score=0.5
            )
    
    def get_search_queries(self, enhanced_query: EnhancedQuery, max_queries: int = 5) -> List[str]:
        """Get the best search queries from enhanced query.
        
        Args:
            enhanced_query: Enhanced query object
            max_queries: Maximum number of queries to return
            
        Returns:
            List of search queries ordered by expected relevance
        """
        all_queries = []
        
        # Start with original (highest priority)
        all_queries.append(enhanced_query.original)
        
        # Add multi-queries (focused searches)
        all_queries.extend(enhanced_query.multi_queries[:2])
        
        # Add best expanded queries
        all_queries.extend(enhanced_query.expanded[:2])
        
        # Remove duplicates while preserving order
        unique_queries = []
        seen = set()
        for query in all_queries:
            if query.lower() not in seen:
                unique_queries.append(query)
                seen.add(query.lower())
        
        return unique_queries[:max_queries]


# Global query enhancer instance
query_enhancer = FrenchQueryEnhancer()