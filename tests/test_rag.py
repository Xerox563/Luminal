import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.retrieval import retrieve, RetrievalResult
from app.services.vector_store.base import DocumentChunk, VectorStoreRegistry
from app.services.rag import inject_context, needs_rag, format_response_with_citations
from app.services.tool_calling import decide_tool_call, ToolCallDecision
from app.services.tool_execution import process_tool_calls, format_tool_results, ToolExecutionResult
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_chunks():
    return [
        DocumentChunk(
            id="chunk1",
            content="The capital of France is Paris.",
            metadata={"filename": "france.txt", "user_id": 1, "chunk_index": 0},
            score=0.95
        ),
        DocumentChunk(
            id="chunk2",
            content="France is a country in Europe.",
            metadata={"filename": "france.txt", "user_id": 1, "chunk_index": 1},
            score=0.85
        )
    ]


@pytest.fixture
def mock_tools():
    from app.models import MCPToolConfig
    return [
        MCPToolConfig(
            id=1,
            user_id=1,
            name="get_weather",
            description="Get weather",
            endpoint_url="https://api.weather.com",
            trigger_keywords=["weather", "temperature"],
            is_active=True
        ),
        MCPToolConfig(
            id=2,
            user_id=1,
            name="calculate",
            description="Calculate math",
            endpoint_url="https://api.calc.com",
            trigger_keywords=["calculate", "math"],
            is_active=True
        ),
        MCPToolConfig(
            id=3,
            user_id=1,
            name="search_web",
            description="Search web",
            endpoint_url="https://api.search.com",
            trigger_keywords=["search", "find"],
            is_active=True
        )
    ]


@pytest.mark.asyncio
async def test_needs_rag_positive():
    assert needs_rag("What is the capital of France?") is True
    assert needs_rag("Explain quantum computing") is True
    assert needs_rag("Tell me about Python") is True
    assert needs_rag("How to bake a cake") is True


@pytest.mark.asyncio
async def test_needs_rag_negative():
    assert needs_rag("Hello world") is False
    assert needs_rag("Write a poem") is False
    assert needs_rag("Generate code") is False


@pytest.mark.asyncio
async def test_format_response_with_citations():
    content = "Paris is the capital of France."
    citations = "\n\nSources:\n[1] france.txt (chunk 0, relevance: 0.95)"
    
    result = format_response_with_citations(content, citations)
    assert "Sources:" in result
    assert "france.txt" in result
    
    result_no_citations = format_response_with_citations(content, "")
    assert result_no_citations == content


@pytest.mark.asyncio
async def test_decide_tool_call_weather(mock_db, mock_tools):
    with patch('app.services.tool_calling.get_active_mcp_tools') as mock_get_tools:
        mock_get_tools.return_value = mock_tools
        decision = await decide_tool_call(mock_db, 1, "What is the weather in Paris?")
        assert decision.should_call is True
        assert decision.tool_name == "get_weather"
        assert decision.confidence >= 0.5


@pytest.mark.asyncio
async def test_decide_tool_call_calculate(mock_db, mock_tools):
    with patch('app.services.tool_calling.get_active_mcp_tools') as mock_get_tools:
        mock_get_tools.return_value = mock_tools
        decision = await decide_tool_call(mock_db, 1, "Calculate 2 + 2")
        assert decision.should_call is True
        assert decision.tool_name == "calculate"
        assert decision.confidence >= 0.5


@pytest.mark.asyncio
async def test_decide_tool_call_search(mock_db, mock_tools):
    with patch('app.services.tool_calling.get_active_mcp_tools') as mock_get_tools:
        mock_get_tools.return_value = mock_tools
        decision = await decide_tool_call(mock_db, 1, "Search for latest AI news")
        assert decision.should_call is True
        assert decision.tool_name == "search_web"
        assert decision.confidence >= 0.5


@pytest.mark.asyncio
async def test_decide_tool_call_no_tool(mock_db, mock_tools):
    with patch('app.services.tool_calling.get_active_mcp_tools') as mock_get_tools:
        mock_get_tools.return_value = mock_tools
        decision = await decide_tool_call(mock_db, 1, "Write a poem about cats")
        assert decision.should_call is False
        assert decision.tool_name is None


@pytest.mark.asyncio
async def test_format_tool_results():
    results = [
        ToolExecutionResult(
            tool_name="get_weather",
            success=True,
            result={"city": "Paris", "temperature": 20},
            arguments={"city": "Paris"}
        ),
        ToolExecutionResult(
            tool_name="calculate",
            success=False,
            result=None,
            error="Invalid expression",
            arguments={"expression": "2 / 0"}
        )
    ]
    
    formatted = format_tool_results(results)
    assert "Tool Results:" in formatted
    assert "get_weather" in formatted
    assert "Paris" in formatted
    assert "calculate" in formatted
    assert "Error" in formatted


@pytest.mark.asyncio
async def test_format_tool_results_empty():
    result = format_tool_results([])
    assert result == ""


@pytest.mark.asyncio
async def test_retrieve_returns_chunks():
    with patch('app.services.retrieval.VectorStoreRegistry.get') as mock_get:
        mock_store = AsyncMock()
        mock_store.search.return_value = [
            DocumentChunk(id="1", content="test", metadata={"user_id": 1}, score=0.9)
        ]
        mock_get.return_value = mock_store
        
        result = await retrieve(query="test", user_id=1, k=5)
        assert isinstance(result, RetrievalResult)
        assert result.total_chunks == 1
        assert result.chunks[0].content == "test"


@pytest.mark.asyncio
async def test_inject_context_no_rag_needed():
    result = await inject_context("Hello world", user_id=1)
    assert result.used_rag is False
    assert result.augmented_prompt == "Hello world"
    assert result.citations == []


@pytest.mark.asyncio
async def test_inject_context_with_chunks(mock_chunks):
    with patch('app.services.rag.retrieve_for_rag') as mock_retrieve:
        mock_retrieve.return_value = RetrievalResult(
            chunks=mock_chunks,
            query="capital of France",
            total_chunks=2,
            retrieval_time_ms=50
        )
        
        result = await inject_context("What is the capital of France?", user_id=1)
        
        assert result.used_rag is True
        assert len(result.citations) == 2
        assert "Context:" in result.augmented_prompt
        assert "capital of France" in result.augmented_prompt
        assert result.citation_text != ""
        assert "Sources:" in result.citation_text


@pytest.mark.asyncio
async def test_process_tool_calls_no_tool(mock_db, mock_tools):
    with patch('app.services.tool_calling.get_active_mcp_tools') as mock_get_tools:
        mock_get_tools.return_value = mock_tools
        
        with patch('app.services.tool_calling.decide_tool_call') as mock_decide:
            mock_decide.return_value = ToolCallDecision(
                should_call=False,
                tool_name=None,
                arguments={},
                confidence=0.0,
                reasoning="No tool needed"
            )
            
            results = await process_tool_calls(mock_db, 1, "Write a poem")
            assert results == []


@pytest.mark.asyncio
async def test_process_tool_calls_with_tool(mock_db, mock_tools):
    with patch('app.services.tool_calling.get_active_mcp_tools') as mock_get_tools:
        mock_get_tools.return_value = mock_tools
        
        with patch('app.services.tool_calling.decide_tool_call') as mock_decide:
            mock_decide.return_value = ToolCallDecision(
                should_call=True,
                tool_name="calculate",
                arguments={"expression": "2 + 2"},
                confidence=0.8,
                reasoning="Math calculation detected"
            )
            
            with patch('app.services.tool_execution.execute_tool_call') as mock_execute:
                mock_execute.return_value = ToolExecutionResult(
                    tool_name="calculate",
                    success=True,
                    result={"expression": "2 + 2", "result": 4},
                    arguments={"expression": "2 + 2"}
                )
                
                results = await process_tool_calls(mock_db, 1, "Calculate 2 + 2")
                assert len(results) == 1
                assert results[0].tool_name == "calculate"
                assert results[0].success is True