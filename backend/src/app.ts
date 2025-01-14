import cors from 'cors';
import express from 'express';
import queryTypes from 'query-types';

import nonSessionRoutes from './nonSessionRoutes';
import sessionRoutes from './sessionRoutes';

export default express()
	.use(express.json())
	.use(queryTypes.middleware())
	.use(
		cors({
			origin: process.env.CORS_ALLOW_ORIGIN,
			credentials: true,
		})
	)
	.use('/', nonSessionRoutes)
	.use('/', sessionRoutes);
