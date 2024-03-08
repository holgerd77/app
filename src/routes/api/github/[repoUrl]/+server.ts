import uriDecodeParams from '$lib/utils/url-decode-params';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import GitHub from '$lib/utils/github/GitHub';
import { Octokit } from '@octokit/rest';
import { getRedis } from '../../redis';
import { env } from '$env/dynamic/private';
import cached from '$lib/utils/cached';

const octokit = new Octokit({ auth: env.GITHUB_PERSONAL_ACCESS_TOKEN });
const github = new GitHub(octokit);

function mapGhResponse(response: Awaited<ReturnType<(typeof github)['getRepoByUrl']>>) {
  return {
    url: response.html_url,
    description: response.description,
    repoName: response.name,
    ownerName: response.owner.login,
    forksCount: response.forks_count,
    stargazersCount: response.stargazers_count,
    defaultBranch: response.default_branch,
  };
}

export const GET: RequestHandler = async ({ params }) => {
  const { repoUrl } = uriDecodeParams(params);

  const redis = env.CACHE_REDIS_CONNECTION_STRING ? await getRedis() : undefined;

  try {
    const lowercaseRepoUrl = repoUrl.toLowerCase();

    const repo = await cached(redis, lowercaseRepoUrl, 86400, async () => {
      const repo = await github.getRepoByUrl(repoUrl);

      return repo;
    });

    return new Response(JSON.stringify(mapGhResponse(repo)));
  } catch (e) {
    const status =
      typeof e === 'object' && e && 'status' in e && typeof e.status === 'number' ? e.status : 500;

    throw error(status);
  }
};
