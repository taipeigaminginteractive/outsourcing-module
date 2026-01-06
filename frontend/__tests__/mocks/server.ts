// --------------------------------------------
// Mock Server
// Configure a request mocking server with the given request handlers.
// And integrate apiHandlers for different scenarios.
// --------------------------------------------

import { setupServer } from "msw/node";
import { apiHandlers } from "./apiHandlers";

export const server = setupServer(...apiHandlers);
