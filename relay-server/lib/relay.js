const DEBUG = false;

import { WebSocketServer } from 'ws';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { createOrder, addItemToOrder, removeItemFromOrder, modifyItem, getOrder } from '../../src/services/firebase.js';

// Function to remove 'delta' property from event object
function removeDelta(obj) {
  const newObj = { ...obj };
  delete newObj.delta;
  delete newObj.audio;
  return newObj;
}

export class RealtimeRelay {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.sockets = new WeakMap();
    this.wss = null;
  }

  listen(port) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', this.connectionHandler.bind(this));
    this.log(`Listening on ws://localhost:${port}`);
  }

  async connectionHandler(ws, req) {
    if (!req.url) {
      this.log('No URL provided, closing connection.');
      ws.close();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (pathname !== '/') {
      this.log(`Invalid pathname: "${pathname}"`);
      ws.close();
      return;
    }

    // Instantiate new client
    this.log(`Connecting with key "${this.apiKey.slice(0, 3)}..."`);
    const client = new RealtimeClient({ apiKey: this.apiKey });

    // Add this block to register the tools (BUGFIX MB & Claude)
    client.addTool(
      {
        name: 'create_order',
        description: 'Creates a new order for the customer',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      async () => {
        try {
          return;
        } catch (error) {
          const result = { success: false, error: error.message };
          return result;
        }
      }
    );

    client.addTool(
      {
        name: 'add_item_to_order',
        description: 'Adds an item to an existing order',
        parameters: {
          type: 'object',
          properties: {
            orderId: { type: 'string', description: 'ID of the order' },
            itemName: { type: 'string', description: 'Name of the item to add. Capitalize the first letter of each word.' },
            modifications: { type: 'string', description: 'If the user requests a modification to the item, input it here. You must choose one of NO, EX, or LITE, followed by the ingredient.'}
          },
          required: ['orderId', 'itemName'],
        },
      },
      async ({ orderId, itemName, modifications }) => {
        try {
          return;
        } catch (error) {
          const result = { success: false, error: error.message };
          return result;
        }
      }
    );

    client.addTool(
      {
        name: 'remove_item_from_order',
        description: 'Removes an item from an existing order',
        parameters: {
          type: 'object',
          properties: {
            orderId: { type: 'string', description: 'ID of the order' },
            itemId: { type: 'string', description: 'ID of the item to remove' },
          },
          required: ['orderId', 'itemId'],
        },
      },
      async ({ orderId, itemId }) => {
        try {
          return;
        } catch (error) {
          const result = { success: false, error: error.message };
          return result;
        }
      }
    );

    client.addTool(
      {
        name: 'modify_item_in_order',
        description: '',
        parameters: {
          type: 'object',
          properties: {
            orderId: { type: 'string', description: 'ID of the order' },
            itemId: { type: 'string', description: 'This is a unique identifier for each item in the order.'},
            modifications: { type: 'string', description: 'Ingredient to modify and the modifier. You MUST use on of these modifiers: NO, LITE, or EX. (e.g. EX ketchup).'},
          },
          required: ['orderId', 'itemId', 'modifications'],
        }
      },
      async ({ orderId, itemId, modifications, custom_instructions }) => {
        return;
      },
    );

    client.addTool(
      {
        name: 'get_order_details',
        description: 'Get the details of the items in the current order',
        parameters: {
          type: 'object',
          properties: {
            orderId: {type: 'string', descrtiption: 'ID of the order'},
          },
          required: ['orderId'],
        }
      },
      async ({ orderId }) => {
        try {
          return result;
        } catch (error) {
          const result = { success: false, error: error.message };
          return result;
        }
      }
    );

    client.on('conversation.function_call_output', (event) => {
      this.log(`Function call output: ${JSON.stringify(event)}`);
      client.realtime.send('client.conversation.function_call_output', event);
    });
    // End bugix

    // Relay: OpenAI Realtime API Event -> Browser Event
    client.realtime.on('server.*', (event) => {
      this.log(`Relaying "${event.type}" to Client`);
      if (DEBUG) {
        console.log('Server event data:', JSON.stringify(removeDelta(event), null, 2));
      }
      ws.send(JSON.stringify(event));
    });

    // Bugfix MB & Claude
    client.on('conversation.*', (event) => {
      this.log(`Relaying conversation event "${event.type}" to Client`);
      ws.send(JSON.stringify(event));
    });
    // End bugfix

    client.realtime.on('close', () => ws.close());

    // Relay: Browser Event -> OpenAI Realtime API Event
    // We need to queue data waiting for the OpenAI connection
    const messageQueue = [];
    const messageHandler = (data) => {
      try {
        const event = JSON.parse(data);
        this.log(`Relaying "${event.type}" to OpenAI`);
        if (DEBUG) {
          console.log('Event data:', JSON.stringify(removeDelta(event), null, 2));          
        }
        client.realtime.send(event.type, event);
      } catch (e) {
        console.error(e.message);
        this.log(`Error parsing event from client: ${data}`);
      }
    };

    ws.on('message', (data) => {
      if (!client.isConnected()) {
        messageQueue.push(data);
      } else {
        messageHandler(data);
      }
    });
    ws.on('close', () => client.disconnect());

    // Connect to OpenAI Realtime API
    try {
      this.log(`Connecting to OpenAI...`);
      await client.connect();
    } catch (e) {
      this.log(`Error connecting to OpenAI: ${e.message}`);
      ws.close();
      return;
    }
    this.log(`Connected to OpenAI successfully!`);
    while (messageQueue.length) {
      messageHandler(messageQueue.shift());
    }
  }

  log(...args) {
    console.log(`[RealtimeRelay]`, ...args);
  }
}
