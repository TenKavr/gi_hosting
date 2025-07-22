<?php

// 强制关闭PHP错误报告，确保只输出JSON
error_reporting(0);
@ini_set('display_errors', 0);

header('Content-Type: application/json');

// 允许跨域请求，根据实际情况调整
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// 处理 OPTIONS 请求（CORS 预检请求）
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 检查cURL扩展是否加载
if (!function_exists('curl_init')) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => '服务器错误: cURL扩展未加载。请检查PHP配置。']);
    exit();
}


// GitHub 配置信息
// !!! 请替换为您的实际信息 !!!
$githubUser = 'user'; // 您的 GitHub 用户名
$githubRepo = 'repository'; // 您的 GitHub 仓库名
$githubToken = 'token'; // 您的 GitHub 个人访问令牌
$githubBranch = 'main'; // 您的仓库分支，通常是 main 或 master

// 检查配置是否已修改
if ($githubUser === 'user' || $githubRepo === 'repository' || $githubToken === 'token') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '配置不完整。请在 upload.php 文件中设置您的 GitHub 用户名、仓库和个人访问令牌。']);
    exit();
}


// 检查是否是 POST 请求
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '只允许 POST 请求。']);
    exit();
}

// 获取 POST 请求的原始数据
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// 检查数据是否有效
if (!isset($data['filename']) || !isset($data['content'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => '缺少文件名或文件内容。']);
    exit();
}

$filename = $data['filename'];
$fileContent = $data['content']; // Base64 编码的图片内容

// 确保文件名是安全的，避免路径遍历等问题
$filename = basename($filename);

// 构建 GitHub API URL
// 图片将上传到仓库的根目录，您可以根据需要修改路径
$pathInRepo = 'images/' . $filename; // 例如，上传到 images 文件夹下
$githubApiUrl = "https://api.github.com/repos/{$githubUser}/{$githubRepo}/contents/{$pathInRepo}";

// 构建请求体
$requestBody = json_encode([
    'message' => 'Upload image ' . $filename,
    'content' => $fileContent, // Base64 编码的内容
    'branch' => $githubBranch
]);

// 设置 cURL 选项
$ch = curl_init($githubApiUrl);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'User-Agent: PHP-GitHub-Image-Uploader',
    'Authorization: token ' . $githubToken,
    'Content-Type: application/json',
    'Accept: application/vnd.github.v3+json'
]);
// 临时关闭SSL证书验证（仅测试用，生产环境请配置CA证书）
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);

// 执行 cURL 请求
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// 处理响应
if ($httpCode === 200 || $httpCode === 201) {
    $responseData = json_decode($response, true);
    // GitHub 返回的 download_url 是原始文件链接
    $imageUrl = $responseData['content']['download_url'] ?? null;

    if ($imageUrl) {
        echo json_encode(['success' => true, 'message' => '图片上传成功！', 'imageUrl' => $imageUrl]);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => '上传成功但未获取到图片链接。', 'response' => $responseData]);
    }
} else {
    http_response_code(500); // 使用500表示服务器端错误
    $errorMessage = 'GitHub API 请求失败。';
    if ($error) {
        $errorMessage .= ' cURL 错误: ' . $error;
    } else {
        $responseData = json_decode($response, true);
        $errorMessage .= ' HTTP 状态码: ' . $httpCode . '. GitHub返回信息: ' . ($responseData['message'] ?? '未知错误，请检查配置和文件路径。');
    }
    echo json_encode(['success' => false, 'message' => $errorMessage, 'httpCode' => $httpCode, 'response' => $responseData ?? null]);
}

?>