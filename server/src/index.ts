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

export default {
	async fetch(request, env, ctx): Promise<Response> {

		const server = new McpServer({
			name: "Dev Env",
			version: "1.0",
		});

		registerAppResource(server, "Dev Widget", "ui://dev-widget", {description: "Dev Widget"},
			async () => {
				const html = await env.ASSETS.fetch(new URL("http://your-aledmana-worker.com/index.html"))
				return {
					contents: [
						{
							uri: "ui://dev-widget",
							text: await html.text(),
							mimeType: RESOURCE_MIME_TYPE,
						}
					]
				}
			}
		);

		registerAppTool(
			server,
			"do-stuff",
			{
				description: "stuff",
				inputSchema: {},
				_meta: {
					ui: {
						resourceUri: "ui://dev-widget",
					},
				},
			}, async () => {
				return {
					content: [
						{ text: "stuff", type: "text" }
					],
				};
			},
		);

		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
