import { Route } from '@/types';
import got from '@/utils/got';
import { config } from '@/config';

export const route: Route = {
    path: '/contributors/:user/:repo/:order?/:anon?',
    categories: ['programming'],
    example: '/github/contributors/DIYgod/RSSHub',
    parameters: { user: 'User name', repo: 'Repo name', order: 'Sort order by commit numbers, desc and asc (descending by default)', anon: 'Show anonymous users. Defaults to no, use any values for yes.' },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['github.com/:user/:repo/graphs/contributors', 'github.com/:user/:repo'],
            target: '/contributors/:user/:repo',
        },
    ],
    name: 'Repo Contributors',
    maintainers: ['zoenglinghou'],
    handler,
};

async function handler(ctx) {
    const { user, repo, order, anon } = ctx.req.param();

    const host = `https://github.com/${user}/${repo}`;
    const url = `https://api.github.com/repos/${user}/${repo}/contributors?` + (anon ? 'anon=1' : '');

    // Use token if available
    const headers = {};
    if (config.github && config.github.access_token) {
        headers.Authorization = `token ${config.github.access_token}`;
    }

    // First page
    const response = await got({
        method: 'get',
        url,
        headers,
    });
    let data = response.data;

    try {
        // Get total page number
        const last_page_link = response.headers.link.split(',').find((elem) => elem.includes('"last"'));
        const url_base = last_page_link.match(/<(.*)page=\d*/)[1];
        const page_count = Number(last_page_link.match(/page=(\d*)/)[1]);

        const generate_array = (n) => Array.from({ length: n - 1 }).map((_, index) => index + 2);
        const page_array = generate_array(page_count);

        // Get everypage
        const tasks = page_array.map(async (page) => {
            const response = await got({
                method: 'get',
                url: `${url_base}page=${page}`,
                headers,
            });
            data = [...data, ...response.data];
        });
        await Promise.all(tasks);
    } catch (error) {
        // If only one page

        // Other errors
        if (!(error instanceof TypeError)) {
            throw error;
        }
    }

    // Sort by commits
    data.sort((a, b) => a.contributions - b.contributions);
    if (order !== 'asc') {
        data.reverse();
    }

    const items = data.map((item) =>
        item.type === 'Anonymous'
            ? {
                  title: `Contributor: ${item.name}`,
                  description: `<p>Anonymous contributor</p><p>Name: ${item.name}</p><p>E-mail: ${item.email}</p><p>Contributions: ${item.contributions}</p>`,
                  guid: `anon-${item.name}`,
              }
            : {
                  title: `Contributor: ${item.login}`,
                  description: `<img src="${item.avatar_url}"></img><p><a href="${item.html_url}">${item.login}</a></p><p>Contributions: ${item.contributions}</p>`,
                  link: item.html_url,
                  guid: item.id,
              }
    );

    return {
        title: `${user}/${repo} Contributors`,
        link: `${host}/graphs/contributors`,
        description: `New contributors for ${user}/${repo}`,
        item: items,
    };
}
