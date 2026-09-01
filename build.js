const fs = require('fs');
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');

// ===== 設定路徑 =====
const ARTICLES_DIR = './articles';
const TEMPLATES_DIR = './templates';
const DIST_DIR = './dist';

// 如果 dist 資料夾不存在，就建立它
if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR);
}

// ===== 定義所有分類（包含最新消息 2 個 + 服務內容 7 個）=====
const categories = {
    // === 最新消息 ===
    'tax-news': { name: '稅務新聞', slug: 'tax-news', articles: [] },
    'firm-news': { name: '本所公告', slug: 'firm-news', articles: [] },
    
    // === 服務內容總覽 (7大項) ===
    'company-reg': { name: '公司設立/變更登記', slug: 'company-reg', articles: [] },
    'accounting': { name: '帳務處理', slug: 'accounting', articles: [] },
    'tax-consult': { name: '稅務申報與諮詢', slug: 'tax-consult', articles: [] },
    'labor-ins': { name: '勞健保專區', slug: 'labor-ins', articles: [] },
    'licensed-business': { name: '特許行業登記', slug: 'licensed-business', articles: [] },
    'foreign-invest': { name: '外國人投資', slug: 'foreign-invest', articles: [] },
    'addr-rental': { name: '登記地址租借/虛擬辦公室', slug: 'addr-rental', articles: [] }
};

// ===== 讀取所有 .md 檔案 =====
const files = fs.readdirSync(ARTICLES_DIR).filter(file => file.endsWith('.md'));

// ===== 解析每篇文章 =====
files.forEach(fileName => {
    const filePath = path.join(ARTICLES_DIR, fileName);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // 使用 gray-matter 解析 Front Matter
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

// ===== 對每個分類內的文章「依照日期排序」（最新在前）=====
Object.keys(categories).forEach(key => {
    categories[key].articles.sort((a, b) => (a.date < b.date ? 1 : -1));
});

// ===== 讀取共用 Layout（外框）=====
const layoutTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'layout.html'), 'utf8');

// ===== 1. 產生所有「列表頁」（各分類的文章清單）=====
Object.keys(categories).forEach(key => {
    const cat = categories[key];
    if (cat.articles.length === 0) {
        console.log(`⚠️ 跳過 ${key}：該分類尚無文章`);
        return;
    }

    // 讀取 list.html 作為內容區塊
    let listTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'list.html'), 'utf8');
    
    // 產生文章標題清單
    let listItems = '';
    cat.articles.forEach(article => {
        listItems += `<li><a href="${article.slug}">${article.title}</a> (${article.date})</li>\n`;
    });

    // 替換佔位符
    let listContent = listTemplate.replace('{{listItems}}', listItems);
    listContent = listContent.replace('{{pageTitle}}', cat.name);

    // 套入 Layout
    let finalPage = layoutTemplate.replace('{{content}}', listContent);
    finalPage = finalPage.replace(/{{title}}/g, cat.name);
    finalPage = finalPage.replace(/{{description}}/g, `大佳稅務記帳士事務所 - ${cat.name} 文章列表`);

    // 寫入 dist 資料夾
    const outputFile = path.join(DIST_DIR, `${key}.html`);
    fs.writeFileSync(outputFile, finalPage);
    console.log(`✅ 已產生列表頁: ${outputFile}`);
});

// ===== 2. 產生所有「單篇文章內容頁」=====
Object.keys(categories).forEach(key => {
    const cat = categories[key];
    cat.articles.forEach(article => {
        // 讀取 article.html 作為內容區塊
        let articleTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'article.html'), 'utf8');
        
        // 替換文章內容
        let content = articleTemplate.replace('{{articleTitle}}', article.title);
        content = content.replace('{{date}}', article.date);
        content = content.replace('{{articleBody}}', article.htmlBody);

        // 套入 Layout
        let finalPage = layoutTemplate.replace('{{content}}', content);
        finalPage = finalPage.replace(/{{title}}/g, article.title);
        finalPage = finalPage.replace(/{{description}}/g, article.description || article.title);

        // 寫入 dist 資料夾
        const outputFile = path.join(DIST_DIR, article.slug);
        fs.writeFileSync(outputFile, finalPage);
        console.log(`✅ 已產生文章頁: ${outputFile}`);
    });
});

// ===== 3. 產生「最新消息彙整頁 (news.html)」=====
const newsTemplatePath = path.join(TEMPLATES_DIR, 'page_news.html');
if (fs.existsSync(newsTemplatePath)) {
    let newsContent = fs.readFileSync(newsTemplatePath, 'utf8');
    
    // 🔹 稅務新聞：最多顯示 2 則（依日期排序，最新在前）
    // 若要調整顯示則數，請修改下面的數字 2
    const TAX_NEWS_LIMIT = 2;
    let taxList = '';
    const taxArticles = categories['tax-news'] ? categories['tax-news'].articles : [];
    if (taxArticles.length > 0) {
        const displayArticles = taxArticles.slice(0, TAX_NEWS_LIMIT);
        displayArticles.forEach(article => {
            taxList += `<li><a href="${article.slug}">${article.title}</a> <span style="color:#718096;font-size:14px;">（${article.date}）</span></li>\n`;
        });
        if (taxArticles.length > TAX_NEWS_LIMIT) {
            taxList += `<li style="list-style:none; margin-top:8px;"><a href="tax-news.html" style="color:#1a365d; font-weight:600;">→ 查看全部稅務新聞</a></li>`;
        }
    } else {
        taxList = '<li>尚無稅務新聞</li>';
    }

    // 🔹 本所公告：最多顯示 2 則（依日期排序，最新在前）
    const FIRM_NEWS_LIMIT = 2;
    let firmList = '';
    const firmArticles = categories['firm-news'] ? categories['firm-news'].articles : [];
    if (firmArticles.length > 0) {
        const displayArticles = firmArticles.slice(0, FIRM_NEWS_LIMIT);
        displayArticles.forEach(article => {
            firmList += `<li><a href="${article.slug}">${article.title}</a> <span style="color:#718096;font-size:14px;">（${article.date}）</span></li>\n`;
        });
        if (firmArticles.length > FIRM_NEWS_LIMIT) {
            firmList += `<li style="list-style:none; margin-top:8px;"><a href="firm-news.html" style="color:#1a365d; font-weight:600;">→ 查看全部本所公告</a></li>`;
        }
    } else {
        firmList = '<li>尚無本所公告</li>';
    }

    // 替換佔位符
    newsContent = newsContent.replace('{{taxNewsList}}', taxList);
    newsContent = newsContent.replace('{{firmNewsList}}', firmList);

    // 套入 Layout
    let finalPage = layoutTemplate.replace('{{content}}', newsContent);
    finalPage = finalPage.replace(/{{title}}/g, '最新消息');
    finalPage = finalPage.replace(/{{description}}/g, '大佳稅務記帳士事務所 - 稅務新聞與本所公告彙整');

    const outputFile = path.join(DIST_DIR, 'news.html');
    fs.writeFileSync(outputFile, finalPage);
    console.log(`✅ 已產生最新消息彙整頁: ${outputFile}`);
} else {
    console.log('⚠️ 跳過 news.html：模板 page_news.html 不存在');
}

// ===== 4. 產生「固定頁面」(首頁、事務所簡介、服務總覽、常用連結、聯絡我們) =====
const fixedPages = [
    { slug: 'index', title: '首頁', desc: '大佳稅務記帳士事務所 - 專業記帳與稅務服務' },
    { slug: 'about', title: '事務所簡介', desc: '大佳稅務記帳士事務所 - 團隊介紹與服務理念' },
    { slug: 'services', title: '服務內容總覽', desc: '大佳稅務記帳士事務所 - 七項專業服務項目' },
    { slug: 'links', title: '常用連結', desc: '大佳稅務記帳士事務所 - 政府機關與實用工具連結' },
    { slug: 'contact', title: '聯絡我們', desc: '大佳稅務記帳士事務所 - 聯絡資訊與服務時間' }
];

fixedPages.forEach(page => {
    const templatePath = path.join(TEMPLATES_DIR, `page_${page.slug}.html`);
    if (!fs.existsSync(templatePath)) {
        console.log(`⚠️ 跳過 ${page.slug}：模板檔案不存在 (page_${page.slug}.html)`);
        return;
    }
    const content = fs.readFileSync(templatePath, 'utf8');
    let finalPage = layoutTemplate.replace('{{content}}', content);
    finalPage = finalPage.replace(/{{title}}/g, page.title);
    finalPage = finalPage.replace(/{{description}}/g, page.desc);
    
    const outputFile = path.join(DIST_DIR, `${page.slug}.html`);
    fs.writeFileSync(outputFile, finalPage);
    console.log(`✅ 已產生固定頁面: ${outputFile}`);
});

// ===== 完成！=====
console.log('🎉 所有頁面生成完畢！請將 dist 資料夾內的檔案上傳至虛擬主機。');