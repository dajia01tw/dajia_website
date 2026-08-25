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


// ===== 產生「最新消息彙整頁 (news.html)」=====
// 讀取 page_news.html 模板
const newsTemplatePath = path.join(TEMPLATES_DIR, 'page_news.html');
if (fs.existsSync(newsTemplatePath)) {
    let newsContent = fs.readFileSync(newsTemplatePath, 'utf8');
    
    // 產生稅務新聞列表
    let taxList = '';
    if (categories['tax-news'] && categories['tax-news'].articles.length > 0) {
        categories['tax-news'].articles.forEach(article => {
            taxList += `<li><a href="${article.slug}">${article.title}</a> <span style="color:#718096;font-size:14px;">（${article.date}）</span></li>\n`;
        });
    } else {
        taxList = '<li>尚無稅務新聞</li>';
    }
    
    // 產生本所公告列表
    let firmList = '';
    if (categories['firm-news'] && categories['firm-news'].articles.length > 0) {
        categories['firm-news'].articles.forEach(article => {
            firmList += `<li><a href="${article.slug}">${article.title}</a> <span style="color:#718096;font-size:14px;">（${article.date}）</span></li>\n`;
        });
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


// ===== 產生固定頁面 (首頁、事務所簡介、服務總覽、常用連結、聯絡我們) =====
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



console.log('🎉 所有頁面生成完畢！請將 dist 資料夾內的檔案上傳至虛擬主機。');