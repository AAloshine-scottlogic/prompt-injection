import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import session from 'express-session';
import memoryStoreFactory from 'memorystore';
import { fileURLToPath } from 'node:url';

import { importMetaUrl } from './importMetaUtils';
import { ChatModel, defaultChatModel } from './models/chat';
import { LevelState, levelsInitialState } from './models/level';
import { router } from './router';

dotenv.config();

declare module 'express-session' {
	interface Session {
		initialised: boolean;
		chatModel: ChatModel;
		levelState: LevelState[];
	}
}

// Check mandatory ENV vars
const sessionSigningSecret = process.env.SESSION_SECRET;
if (!sessionSigningSecret) {
  console.error("SESSION_SECRET not found in environment vars, cannot continue!");
  process.exit(1);
}

const app = express();
const isProd = app.get('env') === 'production';
console.log(`env=${app.get('env')}`);

// for parsing application/json
app.use(express.json());

app.use(
	cors({
		origin: process.env.CORS_ALLOW_ORIGIN,
		credentials: true,
	})
);

// This doesn't work with APIGW's newer HTTP API, cos it's using Forwarded
// request header, not X-Forwarded headers. Maybe try with NLB inbetween?
app.set('trust proxy', true);

// use session storage - currently in-memory, but in future use Redis in prod builds
const maxAge = 60 * 60 * 1000 * (isProd ? 1 : 8); //1 hour in prod, 8hrs in dev
const sessionOpts: session.SessionOptions = {
	name: 'prompt-injection.sid',
	resave: false,
	saveUninitialized: true,
	secret: sessionSigningSecret,
	store: new (memoryStoreFactory(session))({
		checkPeriod: maxAge,
	}),
	cookie: {
		maxAge,
		// Different domains for UI and API in AWS, until we buy a domain...
		sameSite: isProd ? 'none' : 'strict',
		secure: isProd,
	},
};

app.use(session(sessionOpts));

app.use((req, _res, next) => {
	// initialise session variables first time
	if (!req.session.initialised) {
		req.session.chatModel = defaultChatModel;
		req.session.levelState = levelsInitialState;
		req.session.initialised = true;
	}
	next();
});

app.use((req, res, next) => {
	console.log('Request:', req.path, req.headers);
	res.on('finish', () => {
		console.log('Response:', req.path, res.getHeaders());
	});
	next();
});

app.use('/', router);

// serve the documents folder
app.use(
	'/documents',
	express.static(
		fileURLToPath(new URL('../resources/documents', importMetaUrl()))
	)
);

export default app;
