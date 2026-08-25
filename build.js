const fs = require('fs');
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');  // 請先 npm install gray-matter

// 設定路徑
const ARTICLES_DIR = './articles';
const TEMPLATES_DIR = './templates';
const DIST_DIR = './dist';

if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR);
}

// 讀取所有 .md 檔案
const files = fs.readdirSync(ARTICLES_DIR).filter(file => file.endsWith('.md'));

// 分類容器
const categories = {
    'tax-news': { name: '稅務新聞', slug: 'tax-news', articles: [] },
    'firm-news': { name: '本所公告', slug: 'firm-news', articles: [] },
    // 可再擴充服務項目
};

// 解析每篇文章
files.forEach(fileName => {
    const filePath = path.join(ARTICLES_DIR, fileName);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // 使用 gray-matter 解析
    const parsed = matter(fileContent);
    const frontMatter = parsed.data;
    const body = parsed.content;
    
    // 檢查是否有 categorySlug
    const slug = frontMatter.categorySlug;
    if (!slug || !categories[slug]) {
        console.log(`⚠️ 跳過 ${fileName}：缺少 categorySlug 或分類不存在`);
        return;
    }

    // 將 Markdown 轉為 HTML
    const htmlBody = marked.parse(body);

    // 存入分類
    categories[slug].articles.push({
        fileName: fileName,
        title: frontMatter.title || '無標題',
        description: frontMatter.description || '',
        date: frontMatter.date || '1970-01-01',
        slug: fileName.replace('.md', '.html'),
        htmlBody: htmlBody
    });
});

// 排序（最新在前）
Object.keys(categories).forEach(key => {
    categories[key].articles.sort((a, b) => (a.date < b.date ? 1 : -1));
});

// 讀取 Layout
const layoutTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'layout.html'), 'utf8');

// 產生列表頁
Object.keys(categories).forEach(key => {
    const cat = categories[key];
    if (cat.articles.length === 0) return;

    let listTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'list.html'), 'utf8');
    let listItems = '';
    cat.articles.forEach(article => {
        listItems += `<li><a href="${article.slug}">${article.title}</a> (${article.date})</li>\n`;
    });

    let listContent = listTemplate.replace('{{listItems}}', listItems);
    listContent = listContent.replace('{{pageTitle}}', cat.name);

    let finalPage = layoutTemplate.replace('{{content}}', listContent);
    finalPage = finalPage.replace(/{{title}}/g, cat.name);
    finalPage = finalPage.replace(/{{description}}/g, `大佳稅務記帳士事務所 - ${cat.name} 最新消息`);

    // 選單 active (簡易版)
    const menuItems = ['tax-news', 'firm-news'];
    menuItems.forEach(item => {
        const link = `href="${item}.html"`;
        if (item === key) {
            finalPage = finalPage.replace(link, `class="active" ${link}`);
        }
    });

    const outputFile = path.join(DIST_DIR, `${key}.html`);
    fs.writeFileSync(outputFile, finalPage);
    console.log(`✅ 已產生列表頁: ${outputFile}`);
});

// 產生文章內容頁
Object.keys(categories).forEach(key => {
    const cat = categories[key];
    cat.articles.forEach(article => {
        let articleTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'article.html'), 'utf8');
        let content = articleTemplate.replace('{{articleTitle}}', article.title);
        content = content.replace('{{date}}', article.date);
        content = content.replace('{{articleBody}}', article.htmlBody);

        let finalPage = layoutTemplate.replace('{{content}}', content);
        finalPage = finalPage.replace(/{{title}}/g, article.title);
        finalPage = finalPage.replace(/{{description}}/g, article.description || article.title);

        const menuItems = ['tax-news', 'firm-news'];
        menuItems.forEach(item => {
            const link = `href="${item}.html"`;
            if (item === key) {
                finalPage = finalPage.replace(link, `class="active" ${link}`);
            }
        });

        const outputFile = path.join(DIST_DIR, article.slug);
        fs.writeFileSync(outputFile, finalPage);
        console.log(`✅ 已產生文章頁: ${outputFile}`);
    });
});

console.log('🎉 所有頁面生成完畢！請將 dist 資料夾內的檔案上傳至虛擬主機。');