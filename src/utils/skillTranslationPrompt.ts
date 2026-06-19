/**
 * Skill 翻译提示词工具
 * 用于生成 AI 翻译的提示词，让大模型生成生动的名称和准确的描述
 */

export interface TranslationPromptOptions {
  originalName: string;
  originalDescription: string;
  skillContent: string;
  targetLang: "original" | "zh" | "en";
  translateName: boolean;
  translateDesc: boolean;
}

/**
 * 生成翻译提示词
 * @param options 翻译选项
 * @returns 提示词文本
 */
export function generateTranslationPrompt(options: TranslationPromptOptions): string {
  const {
    originalName,
    originalDescription,
    skillContent,
    targetLang,
    translateName,
    translateDesc,
  } = options;

  // 确定目标语言描述
  const langMap = {
    original: "保持原文不变",
    zh: "简体中文",
    en: "英语",
  };

  const targetLangDesc = langMap[targetLang];

  // 构建翻译要求
  const requirements: string[] = [];

  if (translateName && targetLang !== "original") {
    requirements.push(
      `1. **名称翻译**：将技能名称翻译成${targetLangDesc}。要求：生动、简洁、易记，突出技能的核心功能，避免直译。`
    );
  } else {
    requirements.push(`1. **名称**：保持原名称不变，输出原始名称。`);
  }

  if (translateDesc && targetLang !== "original") {
    requirements.push(
      `2. **描述翻译**：将技能描述翻译成${targetLangDesc}。要求：准确概括技能功能，简洁明了，不超过2-3句话。`
    );
  } else {
    requirements.push(`2. **描述**：保持原描述不变，输出原始描述。`);
  }

  const prompt = `你是一个 AI 编程助手技能的专业翻译和描述优化专家。

## 任务
根据以下技能信息，生成优化的名称和描述。

## 原始信息
- **原始名称**：${originalName}
- **原始描述**：${originalDescription || "无描述"}

## 技能内容（SKILL.md）
\`\`\`
${skillContent}
\`\`\`

## 翻译要求
${requirements.join("\n")}

## 输出格式
请严格按以下 JSON 格式输出，不要包含其他内容：
\`\`\`json
{
  "name": "翻译后的名称",
  "description": "翻译后的描述"
}
\`\`\`

## 注意事项
- 名称要简洁有力，突出核心功能
- 描述要准确易懂，让用户一眼就能理解这个技能的作用
- 如果技能内容中有特殊术语，保留原文并在括号中提供翻译
- 保持专业性，但让非技术人员也能理解`;

  return prompt;
}

/**
 * 解析 AI 返回的翻译结果
 * @param response AI 返回的文本
 * @returns 解析后的名称和描述
 */
export function parseTranslationResponse(response: string): {
  name: string;
  description: string;
} {
  try {
    // 尝试提取 JSON
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        name: parsed.name || "",
        description: parsed.description || "",
      };
    }

    // 尝试直接解析整个响应为 JSON
    const parsed = JSON.parse(response);
    return {
      name: parsed.name || "",
      description: parsed.description || "",
    };
  } catch {
    // 如果解析失败，尝试从文本中提取
    const nameMatch = response.match(/["']?name["']?\s*[:：]\s*["']?([^"'\n]+)["']?/i);
    const descMatch = response.match(/["']?description["']?\s*[:：]\s*["']?([^"'\n]+)["']?/i);

    return {
      name: nameMatch?.[1]?.trim() || "",
      description: descMatch?.[1]?.trim() || "",
    };
  }
}
