/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/supply_chain_program.json`.
 */
export type SupplyChainProgram = {
  "address": "87Uuewo7TdvRdHjbNhb2pVnF3vjFi64XPmT8Ty8mzyzx",
  "metadata": {
    "name": "supplyChainProgram",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "initializeProduct",
      "discriminator": [
        251,
        245,
        7,
        123,
        247,
        50,
        14,
        2
      ],
      "accounts": [
        {
          "name": "productAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  100,
                  117,
                  99,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "serialNumber"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "serialNumber",
          "type": "string"
        },
        {
          "name": "description",
          "type": "string"
        }
      ]
    },
    {
      "name": "logEvent",
      "discriminator": [
        5,
        9,
        90,
        141,
        223,
        134,
        57,
        217
      ],
      "accounts": [
        {
          "name": "productAccount",
          "writable": true
        },
        {
          "name": "eventAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  118,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "productAccount"
              },
              {
                "kind": "account",
                "path": "product_account.events_counter",
                "account": "product"
              }
            ]
          }
        },
        {
          "name": "signer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "eventType",
          "type": {
            "defined": {
              "name": "eventType"
            }
          }
        },
        {
          "name": "description",
          "type": "string"
        }
      ]
    },
    {
      "name": "transferOwnership",
      "discriminator": [
        65,
        177,
        215,
        73,
        53,
        45,
        99,
        47
      ],
      "accounts": [
        {
          "name": "productAccount",
          "writable": true
        },
        {
          "name": "currentOwner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "newOwner",
          "type": "pubkey"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "product",
      "discriminator": [
        102,
        76,
        55,
        251,
        38,
        73,
        224,
        229
      ]
    },
    {
      "name": "supplyChainEvent",
      "discriminator": [
        211,
        55,
        255,
        36,
        84,
        248,
        218,
        52
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidSerialNumber",
      "msg": "Invalid serial number: must be 1-50 characters"
    },
    {
      "code": 6001,
      "name": "invalidDescription",
      "msg": "Invalid description: must be 1-200 characters"
    },
    {
      "code": 6002,
      "name": "unauthorizedAccess",
      "msg": "Unauthorized access"
    },
    {
      "code": 6003,
      "name": "counterOverflow",
      "msg": "Counter overflow"
    }
  ],
  "types": [
    {
      "name": "eventType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "created"
          },
          {
            "name": "shipped"
          },
          {
            "name": "received"
          },
          {
            "name": "qualityCheck"
          },
          {
            "name": "delivered"
          },
          {
            "name": "other"
          }
        ]
      }
    },
    {
      "name": "product",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "serialNumber",
            "type": "string"
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "productStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "eventsCounter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "productStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "created"
          },
          {
            "name": "inTransit"
          },
          {
            "name": "received"
          },
          {
            "name": "delivered"
          },
          {
            "name": "transferred"
          }
        ]
      }
    },
    {
      "name": "supplyChainEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "product",
            "type": "pubkey"
          },
          {
            "name": "eventType",
            "type": {
              "defined": {
                "name": "eventType"
              }
            }
          },
          {
            "name": "description",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "eventIndex",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
