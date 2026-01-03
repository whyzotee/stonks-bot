mod handler;

use serenity::{Client, all::GatewayIntents};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().unwrap();
    let token = std::env::var("DISCORD_TOKEN").expect("Expected a token in the environment");

    let intents = GatewayIntents::GUILD_MESSAGES
        | GatewayIntents::DIRECT_MESSAGES
        | GatewayIntents::MESSAGE_CONTENT;

    let mut client = Client::builder(&token, intents)
        .event_handler(handler::Handler)
        .await
        .expect("Error to Creating client");

    if let Err(why) = client.start().await {
        println!("Client error: {why:?}");
    }

    Ok(())
}
