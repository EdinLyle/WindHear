import { chatCompletion } from '../../modelClients.js';
export async function callLlm(input) {
    const { roleSystem, user, options } = input;
    const modelConfig = {
        provider: options?.provider || (options?.baseUrl?.includes('ollama') ? 'ollama' : 'openai'),
        baseUrl: options?.baseUrl || 'https://api.openai.com/v1',
        apiKey: options?.apiKey,
        model: options?.model || 'gpt-4o',
        timeoutMs: options?.timeoutMs ?? 60000
    };
    const response = await chatCompletion(modelConfig, [
        { role: 'system', content: roleSystem },
        { role: 'user', content: user }
    ]);
    return response;
}
