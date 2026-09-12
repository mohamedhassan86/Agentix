/**
 * Forbidden fixture: Domain importing Infrastructure
 * This file is intentionally violating the dependency rule.
 * It is excluded from production compilation and used only by architecture tests.
 */
// @ts-nocheck
import { INFRASTRUCTURE_LAYER_MARKER } from "../../../src/infrastructure/index.js";

export const forbidden = INFRASTRUCTURE_LAYER_MARKER;
