import { SearchMode, Tweet, TwitterClient } from "agent-twitter-client";
import {
    Memory,
    Runtime,
    elizaLogger,
    generateText,
    getEmbeddingZeroVector,
} from "@elizaos/core";
import { ClientBase } from "./base";
import { wait } from "./utils";

export const twitterMessageHandlerTemplate = `
# Task: Generate a response to the tweet while maintaining the character's voice and perspective.

Current Tweet:
{{currentPost}}

Thread Context:
{{formattedConversation}}

Guidelines:
- Keep responses concise and relevant
- Maintain character voice
- Be engaging but professional
- Maximum length: 280 characters

Generate a response:`;

export const shouldRespondFooter = `
# INSTRUCTIONS: Respond with [RESPOND] if we should respond to this message, [IGNORE] if we should ignore it, and [STOP] if we should stop participating in the conversation.

[Your response here]`;

export const twitterShouldRespondTemplate = (targetUsersStr: string) =>
    `# INSTRUCTIONS: Determine if {{agentName}} (@{{twitterUserName}}) should respond to the message and participate in the conversation.

Response options are RESPOND, IGNORE and STOP.

For all users:
- {{agentName}} should ONLY RESPOND to messages that directly mention @{{twitterUserName}}
- {{agentName}} should IGNORE all messages without a direct @{{twitterUserName}} mention
- {{agentName}} should IGNORE spam or inappropriate content
- {{agentName}} should STOP if asked to stop
- {{agentName}} should STOP if conversation is concluded

{{currentPost}}

Thread of Tweets You Are Replying To:
{{formattedConversation}}

# INSTRUCTIONS: Respond with [RESPOND] if the message directly mentions @{{twitterUserName}}, or [IGNORE] if it doesn't mention @{{twitterUserName}}, and [STOP] if {{agentName}} should stop participating in the conversation.
` + shouldRespondFooter;

export class TwitterInteractionClient extends ClientBase {
    private lastTweetTime: number = 0;
    private processedTweets: Set<string> = new Set();

    constructor(
        private client: TwitterClient,
        runtime: Runtime,
        private pollInterval: number = 120000
    ) {
        super(runtime);
        this.lastTweetTime = Date.now();
    }

    async start() {
        elizaLogger.log("Twitter client started");
        await this.client.init();
        elizaLogger.log("Twitter loaded:", this.client.profile);

        while (true) {
            try {
                await this.checkInteractions();
                await wait(this.pollInterval, this.pollInterval);
            } catch (e) {
                elizaLogger.error("Error in Twitter interaction loop:", e);
                await wait(this.pollInterval, this.pollInterval);
            }
        }
    }

    private async checkInteractions() {
        elizaLogger.log("Checking Twitter interactions");

        try {
            const mentions = await this.client.getMentions();
            elizaLogger.log("Found mentions:", mentions.length);

            for (const tweet of mentions) {
                if (this.processedTweets.has(tweet.id)) {
                    continue;
                }

                try {
                    const thread = await this.client.getConversationThread(tweet.id);
                    const message = await this.createMemory(tweet, thread);

                    // Check if it's a mention
                    const twitterUsername = this.runtime.getSetting("TWITTER_USERNAME");
                    if (tweet.text.toLowerCase().includes(`@${twitterUsername.toLowerCase()}`)) {
                        elizaLogger.log(`Processing mention from @${tweet.username}: ${tweet.text}`);
                        await this.handleTweet({ tweet, message, thread });
                    }

                    this.processedTweets.add(tweet.id);
                } catch (e) {
                    elizaLogger.error("Error processing tweet:", e);
                }
            }
        } catch (e) {
            elizaLogger.error("Error fetching mentions:", e);
        }

        elizaLogger.log("Finished checking Twitter interactions");
    }

    private async handleTweet({
        tweet,
        message,
        thread,
    }: {
        tweet: Tweet;
        message: Memory;
        thread: Tweet[];
    }) {
        if (tweet.userId === this.client.profile.id) {
            return { text: "", action: "IGNORE" };
        }

        if (!message.content.text) {
            return { text: "", action: "IGNORE" };
        }

        const twitterUsername = this.runtime.getSetting("TWITTER_USERNAME");
        const isMentioned = message.content.text.toLowerCase().includes(`@${twitterUsername.toLowerCase()}`);

        if (!isMentioned) {
            return { text: "", action: "IGNORE" };
        }

        elizaLogger.log(`Generating response for mention in tweet ${tweet.id}`);

        try {
            const response = await generateText({
                messages: [{
                    role: "user",
                    content: message.content.text
                }],
                modelProvider: "openai",
                model: "small"
            });

            if (response) {
                await this.client.replyToTweet(tweet.id, response);
                elizaLogger.log(`Successfully replied to tweet ${tweet.id} with response: ${response}`);
            }
        } catch (e) {
            elizaLogger.error("Error generating/sending response:", e);
        }

        return { text: "", action: "RESPOND" };
    }

    private async createMemory(tweet: Tweet, thread: Tweet[]): Promise<Memory> {
        const threadWithoutCurrent = thread.filter((t) => t.id !== tweet.id);
        const formattedThread = threadWithoutCurrent
            .map((t) => `@${t.username}: ${t.text}`)
            .join("\n");

        const content = {
            text: tweet.text,
            action: "",
        };

        const embedding = await getEmbeddingZeroVector();

        return {
            userId: this.runtime.agentId,
            roomId: tweet.id,
            agentId: this.runtime.agentId,
            content,
            embedding,
            metadata: {
                tweetId: tweet.id,
                username: tweet.username,
                formattedThread,
            },
        };
    }
}