# ecash-chat


## Key Features

- Wallet Messaging: essentially the OP_RETURN messages seen on Cashtab. Shows the sent and received messages as well as an area to send new messages.
- Public Townhall: a free for all forum, potentially separated into categories. Users can interact with each post by Replying to post, following the poster, or tipping in XEC or eToken.
- Authentication and transaction broadcasting via Cashtab Extensions.


## Development

First, run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

Runs the app in development mode.

The page will reload if you make edits.
You will also see any lint errors in the console.

## Testing

```bash
npm run test
```

## Deploy on Vercel

The easiest way to deploy to the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme).

Check out [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.

## Production

In the project directory, run:

```bash
npm run build
```

Builds the app for production to the `build` folder.

## Implementation Roadmap

**V1**
- [x] Address retrieval via extension under NextJs framework
- [x] Retrieve single page tx history data via chronik
- [x] Switch to ChronikClientNode and use the new address() API
- [x] Standalone Tx History component
- [ ] Work with UI SME to modernize the app's UI/UX
- [x] Pagination for tx history
- [x] Add eslint and apply to codebase
- [x] Parsing of tx history to render all OP_RETURN messages
- [ ] Wallet Messaging: customize rendering of sent and received OP_RETURN messages (both cashtab and external)
- [x] Implement Jest + add unit tests for chronik, alias-server & utils
- [x] Add input validation + unit tests
- [ ] Add integration tests
- [x] Retrieve registered and pending aliases for extension wallet
- [x] Wallet Messaging: Send Message feature which sends a query string to Cashtab Extensions using the nominal 5.5 XEC as amount
- [x] Wallet Messaging: Optional send value with message tx
- [x] Wallet Messaging: Enables the use of alias as a destination address
- [ ] Show messaging history for a specific address or alias
- [x] Integrate emoji picker into the message input field
- [ ] Add sticker pack functions
- [ ] Logout function
- [ ] Add dark mode
- [ ] Use blockies for avatar generation
- [ ] Integration of cashtab contact list from extension
- [ ] Implement google analytics
- [ ] Explore Push notifications or unread/read functions
- [ ] Explore File sharing feasibility
- [ ] Explore Voice/Video messaging feasibility
- [ ] Explore Group chats feasibility

**V2**
- [ ] Public Town Hall: Basic posting and retrieval function
- [ ] Basic social-server prototype to handle parsing of posts
- [ ] Public Town Hall: Introduce different categories of townhalls
- [ ] Implement DDOS mitigations
- [ ] Enable use of emojis and [img] tags
- [ ] Follow function
- [ ] Tipping in XEC
- [ ] Tipping in eToken
- [ ] Like function for the post which will be factored to a post's rating
- [ ] Sort by Date/Rating
- [ ] Filter by post, category, keyword, date
- [ ] Public go live

## Dev Notes

Infra considerations:
- The tx generating and broadcasting workload will be handed to Cashtab Extensions via query string.
- Will almost certainly need another alias-server equivalent that handles the heavy lifting of parsing the central payment address for posts.
- Where we store the social profile data is up for discussion - potentially another API call to the server that's parsing town hall posts.

Spec considerations:
- Will need a central payment address for onchain storage of town hall posts, similar to Aliases
- Each town hall category will need to be an OP_RETURN prefix
- Will look into memo cash spec and see if there's anything we can leverage for the concept of "replying" to posts. e.g. do we need new OP_RETURN specs that adds a post ID (e.g. txid)
