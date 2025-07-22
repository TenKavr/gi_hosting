const fileInput = document.getElementById('fileInput');
const uploadArea = document.getElementById('uploadArea');
const fileNameDisplay = document.getElementById('fileName');
const uploadButton = document.getElementById('uploadButton');
const uploadStatus = document.getElementById('uploadStatus');
const imageUrlDiv = document.getElementById('imageUrl');
const uploadedLink = document.getElementById('uploadedLink');

let selectedFiles = [];

// 阻止默认的拖放行为
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false); // 防止在页面其他地方拖放
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 突出显示拖放区域
['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.style.borderColor = '#007bff', false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, () => uploadArea.style.borderColor = '#ccc', false);
});

// 处理文件选择
uploadArea.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFiles);
uploadArea.addEventListener('drop', handleDrop, false);

function handleFiles(e) {
    const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
    if (files.length > 0) {
        // 只保留图片和视频类型
        selectedFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
        if (selectedFiles.length === 0) {
            fileNameDisplay.textContent = '请选择图片或视频文件';
            uploadButton.disabled = true;
            return;
        }
        fileNameDisplay.textContent = `已选择文件: ${selectedFiles.map(f => f.name).join(', ')}`;
        uploadButton.disabled = false;
        uploadStatus.textContent = '';
        imageUrlDiv.style.display = 'none';
    } else {
        selectedFiles = [];
        fileNameDisplay.textContent = '未选择文件';
        uploadButton.disabled = true;
    }
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles({ dataTransfer: { files: files } });
}

uploadButton.addEventListener('click', uploadFiles);

async function uploadFiles() {
    if (!selectedFiles.length) {
        uploadStatus.textContent = '请先选择文件。';
        uploadStatus.className = 'error';
        return;
    }
    uploadButton.disabled = true;
    uploadStatus.textContent = '正在上传...';
    uploadStatus.className = '';
    imageUrlDiv.style.display = 'none';

    // 进度条初始化
    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    progressContainer.style.display = 'block';
    progressFill.style.width = '0';
    progressText.textContent = `0 / ${selectedFiles.length}`;

    let successCount = 0;
    let failCount = 0;
    imageUrlDiv.innerHTML = '';

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const reader = new FileReader();
        // 用Promise包装FileReader
        const fileReadPromise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
        });
        reader.readAsDataURL(file);
        let base64data;
        try {
            base64data = await fileReadPromise;
        } catch (error) {
            failCount++;
            continue;
        }
        base64data = base64data.split(',')[1];
        try {
            const response = await fetch('https://gihosting.2987304764dan.workers.dev/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, content: base64data })
            });
            const result = await response.json();
            if (result.success) {
                successCount++;
                // 只显示 jsDelivr CDN 链接，并作为图片或视频预览
                const match = result.imageUrl.match(/githubusercontent.com\/(.+?)\/(.+?)\/(.+?)\/(.+)/);
                if (match) {
                    const user = match[1];
                    const repo = match[2];
                    const branch = match[3];
                    const path = match[4];
                    const jsdelivrUrl = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${branch}/${path}`;
                    const jsdelivrDiv = document.createElement('div');
                    jsdelivrDiv.style.marginTop = '10px';
                    jsdelivrDiv.style.wordBreak = 'break-all';
                    if (file.type.startsWith('image/')) {
                        jsdelivrDiv.innerHTML = `<div>jsDelivr CDN: <a href="${jsdelivrUrl}" target="_blank">${jsdelivrUrl}</a></div><img src="${jsdelivrUrl}" alt="图片预览" style="max-width:100%;max-height:60vh;display:block;margin:5px auto 0;object-fit:contain;">`;
                    } else if (file.type.startsWith('video/')) {
                        jsdelivrDiv.innerHTML = `<div>jsDelivr CDN: <a href="${jsdelivrUrl}" target="_blank">${jsdelivrUrl}</a></div><video src="${jsdelivrUrl}" controls style="max-width:100%;margin-top:5px;"></video>`;
                    }
                    imageUrlDiv.appendChild(jsdelivrDiv);
                }
            } else {
                failCount++;
                const failDiv = document.createElement('div');
                failDiv.style.color = 'red';
                failDiv.style.marginTop = '10px';
                failDiv.textContent = `${file.name} 上传失败: ${result.message || '未知错误'}`;
                imageUrlDiv.appendChild(failDiv);
            }
        } catch (error) {
            failCount++;
            const failDiv = document.createElement('div');
            failDiv.style.color = 'red';
            failDiv.style.marginTop = '10px';
            failDiv.textContent = `${file.name} 上传过程中发生错误: ${error.message}`;
            imageUrlDiv.appendChild(failDiv);
        }
        // 更新进度条
        const percent = Math.round(((i + 1) / selectedFiles.length) * 100);
        progressFill.style.width = percent + '%';
        progressText.textContent = `${i + 1} / ${selectedFiles.length}`;
    }
    progressText.textContent += `，成功：${successCount}，失败：${failCount}`;
    uploadStatus.textContent = `上传完成。成功：${successCount}，失败：${failCount}`;
    uploadStatus.className = successCount === selectedFiles.length ? 'success' : (successCount > 0 ? 'success' : 'error');
    imageUrlDiv.style.display = 'block';
    uploadButton.disabled = false;
} 