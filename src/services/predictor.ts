/*
*   Function
*   Copyright © 2024 NatML Inc. All Rights Reserved.
*/

import { GraphClient } from "../api"
import type { Predictor } from "../types"

export interface RetrievePredictorInput {
    /**
     * Predictor tag.
     */
    tag: string;
}

export class PredictorService {

    private readonly client: GraphClient;

    public constructor (client: GraphClient) {
        this.client = client;
    }

    /**
     * Retrieve a predictor.
     * @param input Input arguments.
     * @returns Predictor.
     */
    public async retrieve (input: RetrievePredictorInput): Promise<Predictor> {
        const { data: { predictor } } = await this.client.query<{ predictor: Predictor }>({
            query: `query ($input: PredictorInput!) {
                predictor (input: $input) {
                    ${PREDICTOR_FIELDS}
                }
            }`,
            variables: { input }
        });
        return predictor;
    }
}

const PREDICTOR_FIELDS = `
tag
owner {
    username
    name
    avatar
    bio
    website
    github
    created
}
name
status
access
predictions
created
description
card
media
signature {
    inputs {
        name
        type
        description
        range
        optional
        enumeration {
            name
            value
        }
        defaultValue {
            data
            type
            shape
        }
        schema
    }
    outputs {
        name
        type
        description
        range
        optional
        enumeration {
            name
            value
        }
        defaultValue {
            data
            type
            shape
        }
        schema
    }
}
error
license
`;