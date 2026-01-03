use serenity::async_trait;
use serenity::model::channel::Message;
use serenity::prelude::*;
use yahoo_finance_api::{self as yahoo};
pub struct Handler;

#[async_trait]
impl EventHandler for Handler {
    async fn message(&self, ctx: Context, msg: Message) {
        if msg.content == "!ping" {
            if let Err(why) = msg.channel_id.say(&ctx.http, "Pong!").await {
                println!("Error sending message: {why:?}")
            }
        }

        let channel =
            std::env::var("DISCORD_CHANNEL").expect("Expected a channel in the environment");

        if !msg.author.bot && msg.channel_id.get() == channel.parse::<u64>().unwrap() {
            let provider = yahoo::YahooConnector::new().unwrap();

            let response = provider.get_latest_quotes(msg.content.as_str(), "1d").await;

            match response {
                Ok(data) => {
                    let quote = data.last_quote().unwrap();

                    if let Err(why) = msg
                        .channel_id
                        .say(&ctx.http, format!("{} USD", quote.close))
                        .await
                    {
                        println!("Error sending message: {why:?}");
                    }
                }
                Err(err) => {
                    if let Err(why) = msg.channel_id.say(&ctx.http, err.to_string()).await {
                        println!("Error sending message: {why:?}");
                    }
                }
            }
        }
    }
}
