import {
  ChunkFileModel,
  ErrorCode,
  Logger,
  protocolParameters,
  SidetreeError,
} from '@sidetree/common';

import timeSpan from 'time-span';
import Compressor from './util/Compressor';
import CreateOperation from './CreateOperation';
import Delta from './Delta';
import JsonAsync from './util/JsonAsync';
import RecoverOperation from './RecoverOperation';
import UpdateOperation from './UpdateOperation';

/**
 * Defines operations related to a Chunk File.
 */
export default class ChunkFile {
  /**
   * Parses and validates the given chunk file buffer and all the operations within it.
   * @throws SidetreeError if failed parsing or validation.
   */
  public static async parse(chunkFileBuffer: Buffer): Promise<ChunkFileModel> {
    const endTimer = timeSpan();
    const maxAllowedDecompressedSizeInBytes =
      protocolParameters.maxChunkFileSizeInBytes *
      Compressor.estimatedDecompressionMultiplier;
    const decompressedChunkFileBuffer = await Compressor.decompress(
      chunkFileBuffer,
      maxAllowedDecompressedSizeInBytes
    );
    const chunkFileObject = await JsonAsync.parse(decompressedChunkFileBuffer);
    Logger.info(`Parsed chunk file in ${endTimer.rounded()} ms.`);

    // Ensure only properties specified by Sidetree protocol are given.
    const allowedProperties = new Set(['deltas']);
    for (const property in chunkFileObject) {
      if (!allowedProperties.has(property)) {
        throw new SidetreeError(
          ErrorCode.ChunkFileUnexpectedProperty,
          `Unexpected property ${property} in chunk file.`
        );
      }
    }

    // NOTE: THIS IS A TEMPORARY WORKAROUND to handle an intermittent bug where `updateCommitment` is an array of a single element.
    for (const delta of chunkFileObject.deltas) {
      const updateCommitment = delta.updateCommitment;
      if (
        updateCommitment &&
        Array.isArray(updateCommitment) &&
        updateCommitment.length > 0
      ) {
        delta.updateCommitment = updateCommitment[0];
      }
    }
    this.validateDeltasProperty(chunkFileObject.deltas);

    return chunkFileObject;
  }

  private static validateDeltasProperty(deltas: any) {
    // Make sure deltas is an array.
    if (!(deltas instanceof Array)) {
      throw new SidetreeError(
        ErrorCode.ChunkFileDeltasPropertyNotArray,
        'Invalid chunk file, deltas property is not an array.'
      );
    }

    // Validate every delta is an object
    for (const delta of deltas) {
      if (typeof delta !== 'object') {
        throw new SidetreeError(
          ErrorCode.ChunkFileDeltasNotArrayOfObjects,
          'Invalid chunk file, deltas property is not an array of objects.'
        );
      }

      // Verify size of each delta does not exceed the maximum allowed limit.
      Delta.validateDelta(delta);
    }
  }

  /**
   * Creates chunk file buffer.
   * @returns Chunk file buffer. Returns `undefined` if arrays passed in contains no operations.
   */
  public static async createBuffer(
    createOperations: CreateOperation[],
    recoverOperations: RecoverOperation[],
    updateOperations: UpdateOperation[]
  ): Promise<Buffer | undefined> {
    let deltas: any = [];
    deltas = deltas.concat(
      createOperations.map((operation) => operation.delta!)
    );
    deltas = deltas.concat(
      recoverOperations.map((operation) => operation.delta!)
    );
    deltas = deltas.concat(
      updateOperations.map((operation) => operation.delta!)
    );

    if (deltas.length === 0) {
      return undefined;
    }

    const chunkFileModel = {
      deltas,
    };

    const rawData = Buffer.from(JSON.stringify(chunkFileModel));
    const compressedRawData = await Compressor.compress(Buffer.from(rawData));

    return compressedRawData;
  }
}
