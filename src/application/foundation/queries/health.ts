export interface GetLivenessQuery {
  type: "foundation.health.getLiveness";
}

export interface GetReadinessQuery {
  type: "foundation.health.getReadiness";
}

export const GET_LIVENESS_TYPE = "foundation.health.getLiveness";
export const GET_READINESS_TYPE = "foundation.health.getReadiness";
