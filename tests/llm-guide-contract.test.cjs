const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const exists = (filePath) => fs.existsSync(path.join(root, filePath));
const read = (filePath) => fs.readFileSync(path.join(root, filePath), "utf8");

assert(exists("src/backend/app/api/chat.py"), "chat API router should exist");
assert(exists("src/backend/app/api/tts.py"), "TTS API router should exist");
assert(exists("src/backend/app/schemas/chat.py"), "chat schemas should exist");
assert(exists("src/backend/app/schemas/tts.py"), "TTS schemas should exist");
assert(exists("src/backend/app/services/llm_service.py"), "LLM service should exist");
assert(exists("src/backend/app/services/vector_store.py"), "Vector RAG service should exist");
assert(exists("src/backend/app/services/tts_service.py"), "TTS service should exist");
assert(exists("src/backend/app/services/prompt.py"), "guide persona prompt should exist");

const main = read("src/backend/app/main.py");
assert(main.includes("from app.api import admin, chat, tts"), "backend should import chat and TTS routers");
assert(main.includes("app.include_router(chat.router)"), "backend should expose chat router");
assert(main.includes("app.include_router(tts.router)"), "backend should expose TTS router");

const config = read("src/backend/app/core/config.py");
assert(config.includes("dashscope_api_key"), "settings should expose DashScope API key from env");
assert(config.includes("dashscope_model"), "settings should expose DashScope model from env");
assert(config.includes("dashscope_embedding_model"), "settings should expose DashScope embedding model from env");
assert(config.includes("chroma_persist_dir"), "settings should expose ChromaDB persistence path from env");
assert(config.includes("dashscope_tts_model"), "settings should expose DashScope TTS model from env");
assert(config.includes("dashscope_tts_voice"), "settings should expose DashScope TTS voice from env");
assert(config.includes("dashscope_tts_ws_url"), "settings should expose DashScope TTS websocket URL from env");
assert(!config.includes("sk-"), "settings should not hardcode API keys");

const envExample = read("src/backend/.env.example");
assert(envExample.includes("DASHSCOPE_API_KEY="), ".env.example should document DASHSCOPE_API_KEY");
assert(envExample.includes("DASHSCOPE_MODEL="), ".env.example should document DASHSCOPE_MODEL");
assert(envExample.includes("DASHSCOPE_EMBEDDING_MODEL=text-embedding-v3"), ".env.example should document text-embedding-v3 embeddings");
assert(envExample.includes("CHROMA_PERSIST_DIR="), ".env.example should document ChromaDB persistence path");
assert(envExample.includes("DASHSCOPE_TTS_MODEL="), ".env.example should document TTS model");
assert(envExample.includes("DASHSCOPE_TTS_VOICE="), ".env.example should document TTS voice");
assert(envExample.includes("DASHSCOPE_TTS_WS_URL="), ".env.example should document TTS websocket URL");

const prompt = read("src/backend/app/services/prompt.py");
assert(prompt.includes("灵山胜境"), "persona prompt should mention scenic guide context");
assert(prompt.includes("数字人导游"), "persona prompt should define the guide identity");
assert(prompt.includes("不要编造"), "persona prompt should discourage fabrication");
assert(prompt.includes("官方资料包"), "persona prompt should require answers to prioritize retrieved official resources");
assert(!prompt.includes("我还需要查询官方资料"), "persona prompt should not encourage no-material wording when RAG context exists");

const chatRouter = read("src/backend/app/api/chat.py");
assert(chatRouter.includes('@router.post("/chat"'), "chat router should expose POST /api/chat");
assert(chatRouter.includes('@router.post("/chat/stream"'), "chat router should expose POST /api/chat/stream");
assert(chatRouter.includes("StreamingResponse"), "stream route should use StreamingResponse");

const llmService = read("src/backend/app/services/llm_service.py");
assert(llmService.includes("get_resource_pack"), "chat service should retrieve official resource pack context");
assert(llmService.includes("context_for"), "chat service should build RAG context for each tourist question");
assert(llmService.includes("vector_context_for"), "chat service should prefer ChromaDB vector context for each tourist question");
assert(llmService.includes("RAG_CONTEXT_LIMIT"), "chat service should cap retrieved context blocks");
assert(llmService.includes("资料包检索结果"), "chat service should label retrieved context for the LLM");
assert(llmService.includes("未检索到知识库资料"), "chat service should explicitly tell the LLM when no knowledge was found");
assert(llmService.includes("可自由回答"), "LLM should be allowed to answer freely when RAG finds no context");
assert(llmService.includes("_fallback_reply(request.message, rag_context)"), "fallback replies should use retrieved context when DashScope is unavailable");
assert(llmService.includes("_build_messages(request, rag_context)"), "LLM messages should include retrieved context before calling DashScope");

const vectorStore = read("src/backend/app/services/vector_store.py");
assert(vectorStore.includes("chromadb.PersistentClient"), "Vector RAG should persist documents in ChromaDB");
assert(vectorStore.includes("text_type"), "DashScope embedding calls should distinguish document and query embeddings");
assert(vectorStore.includes("text-embedding-v3") || envExample.includes("text-embedding-v3"), "Vector RAG should use text-embedding-v3");
assert(vectorStore.includes("EMBEDDING_BATCH_SIZE = 10"), "DashScope text-embedding-v3 batches should stay within the API limit");
assert(vectorStore.includes("EMBEDDING_MAX_ATTEMPTS"), "Vector RAG should retry transient DashScope embedding failures");
assert(vectorStore.includes("collection.upsert"), "Vector RAG should upsert knowledge chunks into ChromaDB");
assert(vectorStore.includes("collection.query"), "Vector RAG should query ChromaDB by embedding similarity");
assert(vectorStore.includes("output_type") && vectorStore.includes("dense"), "Vector RAG should request dense embeddings");
assert(vectorStore.includes("_embedding_document(chunk)"), "Vector RAG should embed titles together with chunk content");
assert(vectorStore.includes("VECTOR_MAX_DISTANCE"), "Vector RAG should filter low-confidence ChromaDB matches");
assert(vectorStore.includes("delete_collection"), "Vector RAG should support clearing stale ChromaDB vectors before a full rebuild");
assert(
  vectorStore.indexOf("embeddings = _embed_texts") < vectorStore.indexOf("delete_collection"),
  "Vector RAG should prepare embeddings before deleting the old ChromaDB collection"
);

const resourcePack = read("src/backend/app/services/resource_pack.py");
assert(resourcePack.includes("reset_resource_index"), "Resource pack should clear stale vector entries before full ChromaDB rebuilds");

const ttsRouter = read("src/backend/app/api/tts.py");
assert(ttsRouter.includes('@router.post("/tts"'), "TTS router should expose POST /api/tts");
assert(ttsRouter.includes('@router.get("/tts/audio"'), "TTS router should proxy TTS audio as same-origin media");
assert(ttsRouter.includes('@router.get("/tts/audio/{audio_id}"'), "TTS router should serve SDK synthesized local audio");
assert(ttsRouter.includes("synthesize_speech"), "TTS router should call the TTS service");
assert(ttsRouter.includes("StreamingResponse"), "TTS audio proxy should stream remote audio");
assert(ttsRouter.includes("result.audio_url"), "TTS router should read the synthesized audio URL from a structured result");
assert(ttsRouter.includes("result.audio_id"), "TTS router should read SDK synthesized local audio id from a structured result");
assert(ttsRouter.includes("timestamps=timestamps"), "TTS router should return word timestamps for lip sync");
assert(ttsRouter.includes("TtsTimestamp(text=item.text"), "TTS router should serialize service timestamp dataclasses into response models");

const ttsService = read("src/backend/app/services/tts_service.py");
assert(ttsService.includes("SpeechSynthesizer"), "TTS service should call DashScope SpeechSynthesizer");
assert(ttsService.includes("Bearer"), "TTS service should authenticate with Bearer API key");
assert(ttsService.includes("word_timestamp_enabled"), "TTS service should request DashScope word timestamps");
assert(ttsService.includes("sentence") && ttsService.includes("words"), "TTS service should parse sentence words from DashScope response");
assert(ttsService.includes("dashscope.audio.tts_v2"), "TTS service should use DashScope SDK callback path for word timestamps");
assert(ttsService.includes("get_cached_audio"), "TTS service should cache SDK audio bytes for same-origin playback");
assert(ttsService.includes("settings.dashscope_tts_ws_url"), "TTS service should use configured DashScope websocket URL");

const runner = read("run_cyra_demo.py");
assert(runner.includes('("dashscope", "dashscope")'), "runner should require DashScope SDK for timestamp-driven TTS");
assert(runner.includes('("chromadb", "chromadb")'), "runner should require ChromaDB for vector RAG");

const ttsSchema = read("src/backend/app/schemas/tts.py");
assert(ttsSchema.includes("TtsTimestamp"), "TTS schema should expose timestamp items");
assert(ttsSchema.includes("timestamps: list[TtsTimestamp]"), "TTS response should include word timestamps");

const frontend = read("src/frontend/scripts/tourist-live2d.js");
assert(frontend.includes("/api/chat/stream"), "tourist page should call streaming chat endpoint");
assert(frontend.includes("ReadableStream"), "tourist page should process streamed text");
assert(frontend.includes("/api/tts"), "tourist page should request backend TTS");
assert(frontend.includes("audio_src"), "tourist page should play same-origin proxied TTS audio");
assert(!frontend.includes("data.audio_url"), "tourist page should not play remote TTS URLs directly");
assert(frontend.includes("queueGuideSpeech"), "tourist page should queue sentence-level guide speech");
assert(frontend.includes("prepareGuideAudio"), "tourist page should prepare TTS audio ahead of playback");
assert(frontend.includes("playPreparedAudioQueue"), "tourist page should play prepared audio in order");
assert(frontend.includes("startGuidePerformance"), "tourist page should start guide performance while speaking");
assert(frontend.includes("stopGuidePerformance"), "tourist page should stop guide performance after speaking");
assert(frontend.includes("updateGuidePerformance"), "tourist page should animate Live2D parameters during speech");
assert(frontend.includes("setupLipSyncAnalyser"), "tourist page should bind lip sync to the active audio element");
assert(frontend.includes("AudioContext"), "tourist page should use Web Audio for lip sync");
assert(frontend.includes("createMediaElementSource"), "tourist page should analyze the actual TTS audio element");
assert(frontend.includes('activeAudio.crossOrigin = "anonymous"'), "tourist page should load backend audio proxy with CORS enabled for Web Audio");
assert(frontend.includes("getByteTimeDomainData"), "tourist page should derive mouth movement from audio samples");
assert(frontend.includes("playDecodedAudioBuffer"), "tourist page should support decoded audio playback for tighter lip sync");
assert(frontend.includes("decodeAudioData"), "tourist page should decode proxied audio for synchronized Web Audio playback");
assert(frontend.includes("createBufferSource"), "tourist page should play decoded audio through AudioBufferSourceNode");
assert(frontend.includes("timestamps"), "tourist page should consume TTS word timestamps");
assert(frontend.includes("function buildTimestampLipSyncClip"), "tourist page should build lip-sync clips from word timestamps");
assert(frontend.includes("function pickVisemeForText"), "tourist page should map timestamp text to Mao Pro visemes");
assert(frontend.includes("readTimestampLipSyncMouthState"), "tourist page should sample timestamp-driven mouth state");
assert(frontend.includes('setModelParameter("ParamI", mouthState.i)'), "tourist page should drive Mao Pro I viseme");
assert(frontend.includes('setModelParameter("ParamU", mouthState.u)'), "tourist page should drive Mao Pro U viseme");
assert(frontend.includes('setModelParameter("ParamE", mouthState.e)'), "tourist page should drive Mao Pro E viseme");
assert(frontend.includes('setModelParameter("ParamO", mouthState.o)'), "tourist page should drive Mao Pro O viseme");
assert(frontend.includes("app.ticker.add"), "tourist page should drive Live2D parameters from the Pixi ticker");
assert(frontend.includes("PIXI.UPDATE_PRIORITY.LOW"), "tourist page should write lip-sync parameters after model updates");
assert(frontend.includes("ParamA"), "tourist page should drive Mao Pro mouth parameter");
assert(frontend.includes("ParamAngleX"), "tourist page should drive head movement while guiding");
assert(frontend.includes("ParamBodyAngleX"), "tourist page should drive body movement while guiding");
assert(frontend.includes("FACE_FORWARD_ANGLE_X"), "tourist page should keep the character facing the user");
assert(frontend.includes("extractCompletedSentences"), "tourist page should split streamed text into speakable sentences");
assert(!frontend.includes("speechQueue = speechQueue"), "TTS synthesis should not wait for previous audio playback to finish");
assert(!frontend.includes("后续接入景区知识库后"), "tourist page should not use placeholder guide reply");

const html = read("src/frontend/tourist.html");
assert(!html.includes("speechToggle"), "tourist page should not expose a speech toggle");
assert(!html.includes("语音开") && !html.includes("语音关"), "tourist page should not let tourists disable guide speech");

assert(!frontend.includes("speechEnabled"), "tourist speech should always be enabled");
assert(!frontend.includes("speechToggle"), "tourist script should not bind a speech toggle");

console.log("LLM guide contract passed");
