export default {
  async fetch(request, env, ctx) {
    // CORS 处理
    if (request.method === 'OPTIONS') {
      return new Response('', {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // 只允许 POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, message: '只允许 POST 请求。' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 解析请求体
    let data;
    try {
      data = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ success: false, message: '请求体不是有效的JSON。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const { filename, content } = data;
    if (!filename || !content) {
      return new Response(JSON.stringify({ success: false, message: '缺少文件名或文件内容。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // 从环境变量中获取配置
    // 请在 Cloudflare Workers 的设置页面 -> "变量" -> "为此 Worker 添加变量" 中配置以下环境变量:
    // GITHUB_USER: 你的 GitHub 用户名
    // GITHUB_REPO: 你的 GitHub 仓库名
    // GITHUB_TOKEN: 你的 GitHub 个人访问令牌 (https://github.com/settings/tokens)
    const { GITHUB_USER, GITHUB_REPO, GITHUB_TOKEN, GITHUB_BRANCH } = env;

    if (!GITHUB_USER || !GITHUB_REPO || !GITHUB_TOKEN) {
      return new Response(JSON.stringify({ success: false, message: '服务器配置不完整: 缺少 GITHUB_USER, GITHUB_REPO, 或 GITHUB_TOKEN 环境变量。' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    
    // 配置
    const githubUser = GITHUB_USER;
    const githubRepo = GITHUB_REPO;
    const githubToken = GITHUB_TOKEN;
    const githubBranch = GITHUB_BRANCH || 'main'; // 如果未设置，默认为 'main'
    const pathInRepo = `images/${filename}`;
    const githubApiUrl = `https://api.github.com/repos/${githubUser}/${githubRepo}/contents/${pathInRepo}`;

    // 调用 GitHub API 上传
    const githubResponse = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${githubToken}`,
        'User-Agent': 'Cloudflare-Worker-GitHub-Uploader',
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        message: `Upload image ${filename}`,
        content: content,
        branch: githubBranch,
      }),
    });

    const githubResult = await githubResponse.json();

    if (githubResponse.status === 201 || githubResponse.status === 200) {
      const imageUrl = githubResult.content?.download_url;
      return new Response(JSON.stringify({ success: true, message: '图片上传成功！', imageUrl }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        message: githubResult.message || 'GitHub API 请求失败',
        response: githubResult,
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  }
}