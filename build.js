const fs = require('fs');
const path = require('path');
const marked = require('marked');
const matter = require('gray-matter');

// ===== 設定路徑 =====
const ARTICLES_DIR = './articles';
const TEMPLATES_DIR = './templates';
const DIST_DIR = './dist';

if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR);
}

// ===== 日期格式化函數：將 Date 物件或日期字串轉為 yyyy-mm-dd =====
function formatDate(dateInput) {
    if (!dateInput) return '1970-01-01';
    let dateObj = dateInput;
    // 如果已經是 Date 物件，直接使用
    if (dateInput instanceof Date) {
        dateObj = dateInput;
    } else if (typeof dateInput === 'string' || dateInput instanceof String) {
        // 如果是字串，嘗試解析
        const parsed = new Date(dateInput);
        if (!isNaN(parsed.getTime())) {
            dateObj = parsed;
        } else {
            return '1970-01-01'; // 無效日期
        }
    } else {
        return '1970-01-01';
    }
    // 格式化為 yyyy-mm-dd
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

// ===== 分組清單（用於動態生成聚合頁）=====
const groupNews = ['tax-news', 'firm-news'];
const groupServices = ['company-reg', 'accounting', 'tax-consult', 'labor-ins', 'licensed-business', 'foreign-invest', 'addr-rental'];

// ===== 讀取所有 .md 檔案 =====
const files = fs.readdirSync(ARTICLES_DIR).filter(file => file.endsWith('.md'));

// ===== 解析每篇文章 =====
files.forEach(fileName => {
    const filePath = path.join(ARTICLES_DIR, fileName);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    const parsed = matter(fileContent);
    const frontMatter = parsed.data;
    const body = parsed.content;
    
    const slug = frontMatter.categorySlug;
    if (!slug || !categories[slug]) {
        console.log(`⚠️ 跳過 ${fileName}：缺少 categorySlug 或分類不存在`);
        return;
    }

    const htmlBody = marked.parse(body);
    // 格式化日期
    const dateStr = formatDate(frontMatter.date);

    categories[slug].articles.push({
        fileName: fileName,
        title: frontMatter.title || '無標題',
        description: frontMatter.description || '',
        date: dateStr,   // 已格式化為 yyyy-mm-dd
        slug: fileName.replace('.md', '.html'),
        htmlBody: htmlBody,
        pinned: frontMatter.pinned || 999   // ← 加入這一行，預設為 999（不置頂）
    });
});

// ===== 對每個分類內的文章進行排序 =====
// 規則：先依 pinned 數字升序（數字越小越前面），再依日期降序（最新在前）
Object.keys(categories).forEach(key => {
    categories[key].articles.sort((a, b) => {
        // 先比較 pinned（數字小的優先）
        const pinnedA = a.pinned || 999;
        const pinnedB = b.pinned || 999;
        if (pinnedA !== pinnedB) {
            return pinnedA - pinnedB;   // 數字小的排前面
        }
        // 若 pinned 相同，則依日期排序（最新在前）
        return (a.date < b.date ? 1 : -1);
    });
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

    let listTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'list.html'), 'utf8');
    let listItems = '';
    cat.articles.forEach(article => {
        listItems += `<li><a href="${article.slug}">${article.title}</a> (${article.date})</li>\n`;
    });

    let listContent = listTemplate.replace('{{listItems}}', listItems);
    listContent = listContent.replace('{{pageTitle}}', cat.name);

    let finalPage = layoutTemplate.replace('{{content}}', listContent);
    finalPage = finalPage.replace(/{{title}}/g, cat.name);
    finalPage = finalPage.replace(/{{description}}/g, `大佳稅務記帳士事務所 - ${cat.name} 文章列表`);

    const outputFile = path.join(DIST_DIR, `${key}.html`);
    fs.writeFileSync(outputFile, finalPage);
    console.log(`✅ 已產生列表頁: ${outputFile}`);
});

// ===== 2. 產生所有「單篇文章內容頁」=====
// 直接使用全域的 groupNews 和 groupServices（已於上方宣告）
Object.keys(categories).forEach(key => {
    const cat = categories[key];
    cat.articles.forEach(article => {
        // 讀取 article.html 作為內容區塊
        let articleTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'article.html'), 'utf8');

        // ---- 建立麵包屑 ----
        let breadcrumbHtml = '';
        const slug = key;
        const articleTitle = article.title;

        // 判斷分類屬於哪個群組（使用已宣告的全域變數）
        let groupName = '';
        let groupLink = '';
        if (groupNews.includes(slug)) {
            groupName = '最新消息';
            groupLink = 'news.html';
        } else if (groupServices.includes(slug)) {
            groupName = '服務內容總覽';
            groupLink = 'services.html';
        } else {
            // 若無匹配，設為首頁（理論上不發生）
            groupName = '';
            groupLink = '';
        }

        // 組裝麵包屑 HTML
        breadcrumbHtml = `<a href="index.html">首頁</a> › `;
        if (groupName) {
            breadcrumbHtml += `<a href="${groupLink}">${groupName}</a> › `;
        }
        breadcrumbHtml += `<a href="${slug}.html">${cat.name}</a> › `;
        breadcrumbHtml += `<span class="current">${articleTitle}</span>`;

        // 將麵包屑替換到模板中
        articleTemplate = articleTemplate.replace('{{breadcrumb}}', breadcrumbHtml);

        // ---- 替換其他內容 ----
        let content = articleTemplate.replace('{{articleTitle}}', article.title);
        content = content.replace('{{date}}', article.date);
        content = content.replace('{{articleBody}}', article.htmlBody);

        // 套入 Layout
        let finalPage = layoutTemplate.replace('{{content}}', content);
        finalPage = finalPage.replace(/{{title}}/g, article.title);
        finalPage = finalPage.replace(/{{description}}/g, article.description || article.title);

        const outputFile = path.join(DIST_DIR, article.slug);
        fs.writeFileSync(outputFile, finalPage);
        console.log(`✅ 已產生文章頁: ${outputFile}`);
    });
});

// ===== 3. 通用函數：產生「聚合頁面」（如 news.html, services.html）=====
function renderGroupPage(groupList, pageTitle, outputFileName, description) {
    // 讀取聚合頁模板（我們將用同一個模板，但內容由程式生成）
    // 這裡不使用靜態模板，而是直接建構 HTML 內容區塊
    let contentHtml = `<h2>${pageTitle}</h2>\n`;
    contentHtml += `<p>本所提供以下${groupList.length}類資訊，點擊標題可查看詳細內容：</p>\n`;

    groupList.forEach(slug => {
        const cat = categories[slug];
        if (!cat) {
            console.log(`⚠️ 警告：分類 ${slug} 不存在，跳過`);
            return;
        }
        const articles = cat.articles;
        const displayLimit = 2;  // 每類最多顯示 2 則
        const hasArticles = articles.length > 0;

        // 區塊標題與說明
        contentHtml += `<div style="margin: 25px 0; padding: 18px 20px; background: #f7fafc; border-radius: 8px; border-left: 4px solid #1a365d;">\n`;
        contentHtml += `    <h3 style="color: #1a365d; margin-bottom: 5px;"><a href="${slug}.html" style="color: #1a365d; text-decoration: none;">📌 ${cat.name}</a></h3>\n`;
        // 說明文字（可根據分類自訂，此處簡單處理）
        const descMap = {
            'tax-news': '提供最新稅務法規、申報提醒與政策解析。',
            'firm-news': '本所服務異動、休假通知與活動訊息。',
            'company-reg': '協助企業合法設立與變更登記。',
            'accounting': '每月記帳、財務報表編製。',
            'tax-consult': '營業稅、營所稅、個人綜合所得稅申報。',
            'labor-ins': '勞健保投保、級距調整、爭議處理。',
            'licensed-business': '各類特許執照申請輔導。',
            'foreign-invest': '外資來台設立公司與稅務規劃。',
            'addr-rental': '提供台北市登記地址與信件代收服務。'
        };
        contentHtml += `    <p style="color: #4a5568; margin: 0 0 10px 0;">${descMap[slug] || ''}</p>\n`;

        if (hasArticles) {
            // 顯示前 2 篇
            const displayArticles = articles.slice(0, displayLimit);
            contentHtml += `    <ul style="margin: 0; padding-left: 20px;">\n`;
            displayArticles.forEach(article => {
                contentHtml += `        <li><a href="${article.slug}">${article.title}</a> <span style="color:#718096;font-size:14px;">（${article.date}）</span></li>\n`;
            });
            contentHtml += `    </ul>\n`;
            // 若總數大於顯示上限，加入「查看全部」
            if (articles.length > displayLimit) {
                const allLink = `${slug}.html`;
                contentHtml += `    <div style="margin-top: 8px;"><a href="${allLink}" style="color:#1a365d; font-weight:600;">→ 查看全部 ${cat.name}</a></div>\n`;
            }
        } else {
            contentHtml += `    <p style="color:#a0aec0;">尚無文章</p>\n`;
        }
        contentHtml += `</div>\n`;
    });

    // 套入 Layout
    let finalPage = layoutTemplate.replace('{{content}}', contentHtml);
    finalPage = finalPage.replace(/{{title}}/g, pageTitle);
    finalPage = finalPage.replace(/{{description}}/g, description || `大佳稅務記帳士事務所 - ${pageTitle}`);

    const outputFile = path.join(DIST_DIR, outputFileName);
    fs.writeFileSync(outputFile, finalPage);
    console.log(`✅ 已產生聚合頁面: ${outputFile}`);
}

// ===== 產生 news.html =====
renderGroupPage(groupNews, '最新消息', 'news.html', '大佳稅務記帳士事務所 - 稅務新聞與本所公告彙整');

// ===== 產生 services.html =====
renderGroupPage(groupServices, '服務內容總覽', 'services.html', '大佳稅務記帳士事務所 - 七項專業服務項目');

// ===== 4. 產生「固定頁面」(首頁、事務所簡介、常用連結、聯絡我們) =====
const fixedPages = [
    { slug: 'index', title: '首頁', desc: '大佳稅務記帳士事務所 - 專業記帳與稅務服務' },
    { slug: 'about', title: '事務所簡介', desc: '大佳稅務記帳士事務所 - 團隊介紹與服務理念' },
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

console.log('🎉 所有頁面生成完畢！請將 dist 資料夾內的檔案上傳至虛擬主機。');