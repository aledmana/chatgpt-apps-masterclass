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

const WIDGET_URI = "ui://flashcards-widget";

export default {
	async fetch(request, env, ctx): Promise<Response> {

		const server = new McpServer({
			name: "Flashcard Server",
			version: "1.0",
		});

		registerAppResource(server, "Flashcard Widget", WIDGET_URI, {description: "Flashcard Widget"},
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

		await env.FLASHCARDS_KV.put("Hello", "world")

		// create deck

		// list decks

		// open deck

		// mark card (private)

		// reset deck (private)

		// delete deck

		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
