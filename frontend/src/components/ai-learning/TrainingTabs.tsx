import { useRef } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { UploadExampleCard } from "./UploadExampleCard";
import { CurrentTrainingDataset } from "./CurrentTrainingDataset";
import { ProvideFeedback } from "./ProvideFeedback";
import { aiLearningApi } from "../../services/api";
import { useLanguage } from "../../context/useLanguage";

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface TrainingTabsProps {
  refreshKey?: number;
  onDataChanged?: () => void;
}

export function TrainingTabs({ refreshKey = 0, onDataChanged }: TrainingTabsProps) {
  const { t } = useLanguage();
  const goodInputRef = useRef<HTMLInputElement>(null);
  const badInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File, type: "good" | "bad") => {
    const label = type === "good" ? t("goodExample") : t("badExample");

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error(t("invalidFileType"), {
        description: `${t("onlyPdfAccepted")} "${file.name}".`,
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(t("fileTooLarge"), {
        description: t("fileTooLargeDescription").replace("{size}", String(MAX_FILE_SIZE_MB)),
      });
      return;
    }

    try {
      await aiLearningApi.uploadExample(file, type);
      toast.success(`${label} ${t("uploadedLowercase")}`, {
        description: `"${file.name}" ${t("addedToTrainingDataset")}`,
      });
      onDataChanged?.();
    } catch (err) {
      toast.error(t("uploadFailed"), {
        description: err instanceof Error ? err.message : t("somethingWentWrongTryAgain"),
      });
    }
  };

  const onFileSelected = (type: "good" | "bad") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, type);
    e.target.value = "";
  };

  return (
    <Tabs defaultValue="upload">
      <TabsList className="gap-1 rounded-full bg-gray-100 p-1">
        <TabsTrigger
          value="upload"
          className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-white"
        >
          {t("uploadTrainingExamples")}
        </TabsTrigger>
        <TabsTrigger
          value="dataset"
          className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-white"
        >
          {t("trainingDataset")}
        </TabsTrigger>
        <TabsTrigger
          value="feedback"
          className="rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm dark:data-[state=active]:bg-gray-800 dark:data-[state=active]:text-white"
        >
          {t("provideFeedback")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="mt-6">
        <input ref={goodInputRef} type="file" accept=".pdf" className="hidden" onChange={onFileSelected("good")} />
        <input ref={badInputRef} type="file" accept=".pdf" className="hidden" onChange={onFileSelected("bad")} />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <UploadExampleCard
            variant="good"
            icon={ThumbsUp}
            title={t("uploadGoodExample")}
            description={t("uploadGoodExampleDescription")}
            buttonLabel={t("uploadGoodExample")}
            exampleText={t("goodExampleText")}
            onUpload={() => goodInputRef.current?.click()}
          />
          <UploadExampleCard
            variant="bad"
            icon={ThumbsDown}
            title={t("uploadBadExample")}
            description={t("uploadBadExampleDescription")}
            buttonLabel={t("uploadBadExample")}
            exampleText={t("badExampleText")}
            onUpload={() => badInputRef.current?.click()}
          />
        </div>
      </TabsContent>

      <TabsContent value="dataset" className="mt-6">
        <CurrentTrainingDataset refreshKey={refreshKey} />
      </TabsContent>

      <TabsContent value="feedback" className="mt-6">
        <ProvideFeedback refreshKey={refreshKey} onDataChanged={onDataChanged} />
      </TabsContent>
    </Tabs>
  );
}