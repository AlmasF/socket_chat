import {
  pipeline,
  env,
} from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";
// Указываем, где искать файлы модели относительно корня сайта
env.allowRemoteModels = false;
env.localModelPath = "/";

// Загружаем классификатор (путь к папке с моделью)
const classifier = await pipeline("text-classification", "onnx_quantized", {
  quantized: true, // Если используешь сжатую версию
});

const classifyText = async (text) => {
  const result = await classifier(text);
  return result;
};

export { classifyText };
