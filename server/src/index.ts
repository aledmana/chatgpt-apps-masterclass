/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler } from "agents/mcp";
import z from "zod";
import {
	fetchMovieByGenre,
	fetchMovieDetails,
	fetchMovieGenres,
	fetchMovieReviews,
	fetchNowPlayingMovies,
	fetchSimilarMovies,
	fetchUpcomingMovies
} from "./fetcher";

const WIDGET_URI = "ui://movies-widget";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const API_KEY = env.API_KEY;

		const server = new McpServer({
			name: "Movies Server",
			version: "1.0",
		});

		registerAppResource(server, "Movies Widget", WIDGET_URI, {description: "Movies Widget"},
			async () => {
				const html = await env.ASSETS.fetch(new URL("http://your-aledmana-worker.com/index.html"))
				return {
					contents: [
						{
							uri: WIDGET_URI,
							text: await html.text(),
							mimeType: RESOURCE_MIME_TYPE,
							_meta: {
								ui: {
									csp: {
										connectDomains: ['https://*.workers.dev'],
										resourceDomains: [
											'https://*.workers.dev',
											'https://fonts.googleapis.com',
											'https://fonts.gstatic.com',
											'https://image.tmdb.org',
										],
									},
								},
							},
						}
					]
				}
			}
		);

		registerAppTool(
			server,
			'get-upcoming-movies',
			{
				title: 'Get Upcoming Movies',
				description:
					'사용자가 곧 또는 미래에 개봉할 영화를 볼 때 이 도구를 쓴다. 현재 영화관에서 상영 중인 영화에 대해서는 이 도구를 사용하지 말라.',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching upcoming movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				// fetch movies from the api
				const movies = await fetchUpcomingMovies(API_KEY);
				return {
					//content: [{ text: 'stuff', type: 'text' }], // Chatgpt
					//content: [{ text: `Here are the movies: ${movies.map(movie => `${movie.title} ${movie.id}`)}`, type: 'text' }],    // Claude 때 토큰 절약.
					content: [{ text: JSON.stringify(movies), type: 'text' }], // Claude 때 토큰이 많이 들어감.
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-now-playing-movies',
			{
				title: 'Get Now Playing Movies',
				description:
					'사용자가 지금 당장 상영 중인 영화를 볼 때 이 도구를 쓴다. 스트리밍 영화나 개봉 예정작을 확인할 때는 이 도구를 사용하지 말라. 특정 영화를 검색할 때도 사용하지 말것.',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching now playing movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				// fetch movies from the api
				const movies = await fetchNowPlayingMovies(API_KEY);
				return {
					content: [{ text: 'stuff', type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-similar-movies',
			{
				title: 'Get Similar Movies',
				description:
					'사용자가 특정 영화와 비슷한 영화를 찾고 싶을 때 이 도구를 사용한다. 이전 리스트에서 가져온 영화 ID가 필요하다. 특정 영화를 식별하기 전에는 사용하지 말것.',
				inputSchema: {
					movieId: z
						.number()
						.positive()
						.describe(
							'비슷한 영화를 찾기 위한 영화의 id이다. 다른 도구를 먼저 호출해서 얻은 값이다. 예를들면, `get-upcoming-movies` 또는 `get-now-playing-movies`.',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching similar movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				// fetch movies from the api
				const movies = await fetchSimilarMovies(movieId, API_KEY);
				return {
					content: [{ text: 'stuff', type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-movie-reviews',
			{
				title: 'Get Movie Reviews',
				description:
					'사용자가 특정 영화와 대한 리뷰를 찾고 싶을 때 이 도구를 사용한다. 이전 리스트에서 가져온 영화 ID가 필요하다. 특정 영화를 식별하기 전에는 사용하지 말것.',
				inputSchema: {
					movieId: z
						.number()
						.positive()
						.describe(
							'비슷한 영화를 찾기 위한 영화의 id이다. 다른 도구를 먼저 호출해서 얻은 값이다. 예를들면, `get-upcoming-movies` 또는 `get-now-playing-movies`.',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					'openai/toolInvocation/invoking': 'Fetching reviews...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				// fetch movies from the api
				const reviews = await fetchMovieReviews(movieId, API_KEY);
				return {
					content: [{ text: JSON.stringify(reviews), type: 'text' }],
				};
			},
		);

		registerAppTool(
			server,
			'get-movie-genres',
			{
				title: 'Get Movie Genres',
				description:
					'장르 ID 리스트를 조회할 때 사용한다. 이건 `get-movies-by-genre` 도구를 호출하기 전에 사용해야 한다. 영화의 직접 검색에 이것은 사용하지 말 것.',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					'openai/toolInvocation/invoking': 'Fetching genres...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				// fetch movies from the api
				const genres = await fetchMovieGenres(API_KEY);
				return {
					content: [{ text: JSON.stringify(genres), type: 'text' }],
				};
			},
		);

		registerAppTool(
			server,
			'get-movies-by-genre',
			{
				title: 'Get Movies by Genre',
				description: '사용자가 특정 장르의 영화를 찾을 때 이 도구를 사용한다. 먼저 `get-movie-genres`를 사용해서 id 목록을 조회한다.',
				inputSchema: {
					genreId: z
						.number()
						.positive()
						.describe(
							'영화를 조회하기 위한 장르의 id이다. `get-movies-genres` 도구를 사용해 알아낸다. (에를들어: 28은 액션, 99는 다큐멘터리 등)',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ genreId }) => {
				// fetch movies from the api
				const movies = await fetchMovieByGenre(genreId, API_KEY);
				return {
					content: [{ text: 'stuff', type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-movies-details',
			{
				title: 'Get Movies Details',
				description:
					'사용자가 특정 영화에 대한 자세한 정보를 보고 싶을 때 이 도구를 사용한다. 시놉시스, 캐스팅, 평점, 배급사 같은 것들이 세부 정보에 속한다. 이전 리스트에서 가져온 movie ID가 필요하다. 특정 영화를 식별하기 전에는 이 도구를 사용하지 말 것.',
				inputSchema: {
					movieId: z.number().positive().describe('세부 정보를 조회할 영화의 id이다. 영화 리스트를 반환하는 영화 도구를 사용해 가져온다.'),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching movie details...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				// fetch movies from the api
				const movie = await fetchMovieDetails(movieId, API_KEY);
				return {
					content: [{ text: 'stuff', type: 'text' }],
					structuredContent: { movie },
				};
			},
		);

		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
