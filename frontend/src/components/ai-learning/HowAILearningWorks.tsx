import { Brain } from "lucide-react";
import { useLanguage } from "../../context/useLanguage";

interface Step {
  number: number;
  title: string;
  description: string;
}

function StepCard({ number, title, description }: Step) {
  return (
    <div className="rounded-xl bg-white/10 p-5">
      <h3 className="mb-2 text-lg font-bold text-white">
        {number}. {title}
      </h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}

export function HowAILearningWorks() {
  const { t } = useLanguage();

  const steps: Step[] = [
    {
      number: 1,
      title: t("uploadExamples"),
      description: t("uploadExamplesDesc"),
    },
    {
      number: 2,
      title: t("aiLearnsPatterns"),
      description: t("aiLearnsPatternsDesc"),
    },
    {
      number: 3,
      title: t("improvesDetection"),
      description: t("improvesDetectionDesc"),
    },
  ];

  return (
    <div className="rounded-2xl bg-black p-8">
      <div className="mb-3 flex items-center gap-3">
        <Brain className="size-8 text-white" />
        <h2 className="text-xl font-bold text-white">
          {t("howAiLearningWorks")}
        </h2>
      </div>

      <p className="mb-6 text-gray-400">
        {t("aiLearningDescription")}
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <StepCard key={step.number} {...step} />
        ))}
      </div>
    </div>
  );
}