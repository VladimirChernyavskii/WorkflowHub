export type CatalogSort = "date" | "rating" | "downloads";
export type CatalogOrder = "asc" | "desc";

export type BuildCatalogQueryParams = {
  page: number;
  pageSize: number;
  q: string;
  tagSlugs: string[];
  baseModel: string;
  comfyVersion: string;
  sort: CatalogSort;
  order: CatalogOrder;
};

export function buildCatalogQuery(params: BuildCatalogQueryParams): string {
  const sp = new URLSearchParams();
  sp.set("page", String(params.page));
  sp.set("pageSize", String(params.pageSize));
  if (params.q.length > 0) {
    sp.set("q", params.q);
  }
  for (const t of params.tagSlugs) {
    sp.append("tag", t);
  }
  const bm = params.baseModel.trim();
  if (bm.length > 0) {
    sp.set("base_model", bm);
  }
  const cv = params.comfyVersion.trim();
  if (cv.length > 0) {
    sp.set("comfy_version", cv);
  }
  sp.set("sort", params.sort);
  sp.set("order", params.order);
  return sp.toString();
}
