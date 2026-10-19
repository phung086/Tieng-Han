import { beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { GET } from "@/app/api/courses/[courseId]/illustrations/route";
import { resolveCourseSource } from "./course-source-access";
import { readImportPage } from "./import-job-store";
vi.mock("./course-source-access",()=>({resolveCourseSource:vi.fn(),sourceHeaders:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}}));
vi.mock("./import-job-store",()=>({readImportPage:vi.fn()}));
const image={id:"fig",kind:"vocabulary",targetIds:["w"],relation:"exact",fileName:"book.pdf",pageNumber:2,region:[.1,.2,.3,.4],alt:"word",caption:"",sourceRef:"book.pdf p.2"};
const context={params:Promise.resolve({courseId:"course-test"})};
beforeEach(async()=>{
 vi.clearAllMocks();vi.mocked(resolveCourseSource).mockResolvedValue({course:{lessons:[{illustrations:[image]}]},job:{id:"import-test",documents:[{documentId:"doc-0",fileName:"book.pdf",pageCount:3}]}} as never);
 const buffer=await sharp({create:{width:100,height:100,channels:3,background:"blue"}}).png().toBuffer();
 vi.mocked(readImportPage).mockResolvedValue({previewImageDataUrl:"data:image/png;base64,"+buffer.toString("base64")} as never);
});
it("returns the saved crop with private headers and no page surroundings",async()=>{
 const response=await GET(new Request("http://local/illustrations?id=fig&crop=0,0,1,1"),context);
 expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.get("x-content-type-options")).toBe("nosniff");
 expect(await sharp(Buffer.from(await response.arrayBuffer())).metadata()).toMatchObject({width:30,height:40,format:"jpeg"});
});
it("checks access before reading private snapshot pixels",async()=>{
 vi.mocked(resolveCourseSource).mockResolvedValue({error:"Không có quyền xem nguồn của khóa học này.",status:403});
 expect((await GET(new Request("http://local/illustrations?id=fig"),context)).status).toBe(403);expect(readImportPage).not.toHaveBeenCalled();
});
it("never accepts arbitrary file paths or crop coordinates instead of an authored ID",async()=>{
 expect((await GET(new Request("http://local/illustrations?id=../other&file=other.pdf"),context)).status).toBe(404);expect(readImportPage).not.toHaveBeenCalled();
});
it("keeps a missing source image an explicit recoverable error",async()=>{
 vi.mocked(readImportPage).mockRejectedValue(Error("Missing"));
 const response=await GET(new Request("http://local/illustrations?id=fig"),context);expect(response.status).toBe(404);expect(await response.text()).toContain("Nội dung bài vẫn học được");
});
