import { z } from 'zod';
export async function chatCompletion(config, messages) {
    if (config.provider === 'ollama') {
        return ollamaChat(config, messages);
    }
    if (config.provider === 'anthropic') {
        return anthropicChat(config, messages);
    }
    if (config.provider === 'zhipu') {
        return zhipuChat(config, messages);
    }
    return openaiChat(config, messages);
}
async function ollamaChat(config, messages) {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/chat`;
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: config.model ?? 'llama3',
            messages,
            stream: false,
        }),
    }, config.timeoutMs);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Ollama请求失败: ${res.status} ${text}`.slice(0, 500));
    }
    const json = await res.json();
    const parsed = z
        .object({
        message: z.object({ content: z.string() }),
    })
        .safeParse(json);
    if (!parsed.success) {
        throw new Error('Ollama响应解析失败');
    }
    return parsed.data.message.content;
}
async function openaiChat(config, messages) {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
            model: config.model ?? 'gpt-4o-mini',
            messages,
            temperature: 0,
        }),
    }, config.timeoutMs);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`OpenAI请求失败: ${res.status} ${text}`.slice(0, 500));
    }
    const json = await res.json();
    const parsed = z
        .object({
        choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
    })
        .safeParse(json);
    if (!parsed.success) {
        throw new Error('OpenAI响应解析失败');
    }
    return parsed.data.choices[0].message.content ?? '';
}
async function anthropicChat(config, messages) {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/v1/messages`;
    // Anthropic 的 system 消息不放在 messages 中，而是作为顶层 system 字段
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const chatMessages = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }));
    const body = {
        model: config.model ?? 'claude-sonnet-4-20250514',
        messages: chatMessages,
        max_tokens: 4096,
    };
    if (systemMessage) {
        body.system = systemMessage;
    }
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
        },
        body: JSON.stringify(body),
    }, config.timeoutMs);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Anthropic请求失败: ${res.status} ${text}`.slice(0, 500));
    }
    const json = await res.json();
    const parsed = z
        .object({
        content: z.array(z.object({ type: z.string(), text: z.string().optional() })).min(1),
    })
        .safeParse(json);
    if (!parsed.success) {
        throw new Error('Anthropic响应解析失败');
    }
    // 提取第一个 text 类型的 content block
    const textBlock = parsed.data.content.find(b => b.type === 'text' && b.text);
    return textBlock?.text ?? '';
}
async function zhipuChat(config, messages) {
    const baseUrl = config.baseUrl.replace(/\/$/, '');
    // 智谱路径: /v4/chat/completions（不同于OpenAI的/v1/）
    const url = baseUrl.endsWith('/v4')
        ? `${baseUrl}/chat/completions`
        : `${baseUrl}/v4/chat/completions`;
    const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        },
        body: JSON.stringify({
            model: config.model ?? 'glm-4-flash',
            messages,
            temperature: 0,
        }),
    }, config.timeoutMs);
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`智谱请求失败: ${res.status} ${text}`.slice(0, 500));
    }
    const json = await res.json();
    const parsed = z
        .object({
        choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
    })
        .safeParse(json);
    if (!parsed.success) {
        throw new Error('智谱响应解析失败');
    }
    return parsed.data.choices[0].message.content ?? '';
}
async function fetchWithTimeout(url, init, timeoutMs) {
    const ms = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 30_000;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const isAbort = e instanceof Error &&
            (e.name === 'AbortError' || /aborted/i.test(e.message) || /被中止/.test(e.message) || /中止/.test(e.message));
        const head = isAbort ? `请求超时(${ms}ms)` : '请求失败';
        throw new Error(`${head}: ${msg} (${url})`.slice(0, 300));
    }
    finally {
        clearTimeout(t);
    }
}
