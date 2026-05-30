import {
  ArrowLeft,
  Lightbulb,
  Loader2,
  Save,
  Rocket,
  Copy,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { policyApi } from "../api/policies";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { PageHeader } from "../components/PageHeader";
import { PollOptionsEditor } from "../components/PollOptionsEditor";
import { StatusBadge } from "../components/StatusBadge";
import { TagInput } from "../components/TagInput";
import {
  ETHIOPIAN_REGIONS,
  POLL_TYPES,
  POLICY_TOPICS,
} from "../constants/regions";
import { getErrorMessage, toIsoFromDateInput } from "../lib/format";

const policySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().trim().min(1, "Description is required").max(2000),
    targetRegions: z
      .array(z.string())
      .min(1, "Select at least one target region"),
    startDate: z.date({ required_error: "Start date is required" }),
    endDate: z.date({ required_error: "End date is required" }),
    pollType: z.enum([
      "rating",
      "binary",
      "multipleChoice",
      "likert",
      "approval",
      "rankedChoice",
    ]),
    pollOptions: z
      .array(
        z.object({
          id: z.string(),
          text: z.string(),
          shortCode: z.string().optional(),
        }),
      )
      .optional(),
    maxSelections: z.coerce.number().min(1).optional(),
    likertLabels: z.array(z.string()).length(5).optional(),
    rankedChoiceMaxRank: z.coerce.number().min(1).optional(),
    topics: z.array(z.string()).optional(),
    relevanceFactors: z.object({
      women: z.boolean().optional(),
      youth: z.boolean().optional(),
      farmers: z.boolean().optional(),
      urban: z.boolean().optional(),
      rural: z.boolean().optional(),
      privateSector: z.boolean().optional(),
      government: z.boolean().optional(),
    }),
    citizenAnalyticsVisibility: z.object({
      showResults: z.boolean().optional(),
      showBreakdown: z.boolean().optional(),
      showComments: z.boolean().optional(),
      showSentiment: z.boolean().optional(),
      allowTimeFilter: z.boolean().optional(),
    }),
  })
  .refine((value) => value.startDate < value.endDate, {
    path: ["endDate"],
    message: "End date must be after start date",
  });

const emptyValues = {
  title: "",
  description: "",
  targetRegions: [],
  startDate: null,
  endDate: null,
  pollType: "rating",
  pollOptions: [],
  maxSelections: 1,
  likertLabels: [
    "Very Dissatisfied",
    "Dissatisfied",
    "Neutral",
    "Satisfied",
    "Very Satisfied",
  ],
  rankedChoiceMaxRank: 3,
  topics: [],
  relevanceFactors: {
    women: false,
    youth: false,
    farmers: false,
    urban: false,
    rural: false,
    privateSector: false,
    government: false,
  },
  citizenAnalyticsVisibility: {
    showResults: true,
    showBreakdown: false,
    showComments: false,
    showSentiment: false,
    allowTimeFilter: false,
  },
};

export function PolicyFormPage({ mode }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = mode === "edit";
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [policy, setPolicy] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({ defaultValues: emptyValues });

  const selectedRegions = watch("targetRegions") || [];
  const pollType = watch("pollType");
  const topics = watch("topics") || [];
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const canEdit = !isEdit || policy?.status === "draft";

  useEffect(() => {
    let active = true;

    async function loadPolicy() {
      if (!isEdit) return;
      setLoading(true);
      setServerError("");
      try {
        const result = await policyApi.get(id);
        if (!active) return;
        setPolicy(result);
        reset({
          title: result.title || "",
          description: result.description || "",
          targetRegions: result.targetRegions || [],
          startDate: result.startDate ? new Date(result.startDate) : null,
          endDate: result.endDate ? new Date(result.endDate) : null,
          pollType: result.pollType || "rating",
          pollOptions: result.pollOptions || [],
          maxSelections: result.maxSelections || 1,
          likertLabels: result.likertLabels || emptyValues.likertLabels,
          rankedChoiceMaxRank: result.rankedChoiceMaxRank || 3,
          topics: result.topics || [],
          relevanceFactors: {
            ...emptyValues.relevanceFactors,
            ...(result.relevanceFactors || {}),
          },
          citizenAnalyticsVisibility: {
            ...emptyValues.citizenAnalyticsVisibility,
            ...(result.citizenAnalyticsVisibility || {}),
          },
        });
      } catch (err) {
        if (active)
          setServerError(getErrorMessage(err, "Failed to load policy"));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPolicy();
    return () => {
      active = false;
    };
  }, [id, isEdit, reset]);

  const title = useMemo(
    () => (isEdit ? "Edit policy" : "Create policy"),
    [isEdit],
  );

  const toggleRegion = (region) => {
    const current = new Set(selectedRegions);
    if (current.has(region)) {
      current.delete(region);
    } else {
      current.add(region);
    }
    setValue("targetRegions", Array.from(current), { shouldValidate: true });
  };

  const suggestTopics = async () => {
    setAiError("");
    const titleValue = watch("title") || "";
    const descriptionValue = watch("description") || "";
    const text = `${titleValue} ${descriptionValue}`.trim();
    if (text.length < 10) {
      setAiError(
        "Add a title and description (at least 10 characters) before requesting topic suggestions.",
      );
      return;
    }
    setAiLoading(true);
    try {
      const result = await policyApi.suggestTopics(text);
      const suggestedTopics = (result.topics || []).map((item) => item.topic);
      setAiSuggestions(suggestedTopics);
    } catch (err) {
      setServerError(getErrorMessage(err, "Failed to suggest topics"));
    } finally {
      setAiLoading(false);
    }
  };

  const addSuggestion = (topic) => {
    const current = new Set(topics);
    if (!current.has(topic)) {
      setValue("topics", [...topics, topic], { shouldValidate: true });
    }
    setAiSuggestions(aiSuggestions.filter((t) => t !== topic));
  };

  const submit = async (values) => {
    setServerError("");
    setSuccessMessage("");
    setCreatedCode("");

    // Ensure poll options have id and text; shortCode can be empty or undefined
    let pollOptionsToSend = (values.pollOptions || []).map((opt) => ({
      id: opt.id,
      text: opt.text,
      shortCode: opt.shortCode || "",
    }));
    values.pollOptions = pollOptionsToSend;

    const parsed = policySchema.safeParse(values);
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        setError(issue.path[0], { message: issue.message });
      });
      return;
    }

    if (
      ["multipleChoice", "rankedChoice"].includes(parsed.data.pollType) &&
      parsed.data.pollOptions.length === 0
    ) {
      setError("pollOptions", { message: "Add at least one poll option" });
      return;
    }

    const payload = {
      title: parsed.data.title,
      description: parsed.data.description,
      targetRegions: parsed.data.targetRegions,
      startDate: parsed.data.startDate.toISOString(),
      endDate: parsed.data.endDate.toISOString(),
      pollType: parsed.data.pollType,
      pollOptions: parsed.data.pollOptions || [],
      maxSelections: parsed.data.maxSelections,
      likertLabels: parsed.data.likertLabels,
      rankedChoiceMaxRank: parsed.data.rankedChoiceMaxRank,
      relevanceFactors: parsed.data.relevanceFactors,
      citizenAnalyticsVisibility: parsed.data.citizenAnalyticsVisibility,
      topics: parsed.data.topics,
    };

    try {
      setSubmitting(true);
      if (isEdit) {
        await policyApi.update(id, payload);
        setSuccessMessage(
          "Policy updated successfully. You can continue editing or publish.",
        );
      } else {
        const result = await policyApi.create(payload);
        setCreatedCode(result.policyCode);
        navigate(`/policies/${result.id}/edit`);
      }
    } catch (err) {
      setServerError(getErrorMessage(err, "Failed to save policy"));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!id) return;
    setSubmitting(true);
    setServerError("");
    try {
      await policyApi.publish(id);
      navigate(`/policies/${id}`);
    } catch (err) {
      setServerError(getErrorMessage(err, "Failed to publish policy"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleClone = async () => {
    if (!id) return;
    setSubmitting(true);
    setServerError("");
    try {
      const result = await policyApi.clone(id);
      navigate(`/policies/${result.id}/edit`);
    } catch (err) {
      setServerError(getErrorMessage(err, "Failed to clone policy"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (
      !window.confirm("Are you sure you want to permanently delete this draft?")
    )
      return;
    setSubmitting(true);
    setServerError("");
    try {
      await policyApi.delete(id);
      navigate("/policies", { state: { notice: "Draft policy deleted." } });
    } catch (err) {
      setServerError(getErrorMessage(err, "Failed to delete policy"));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading policy" />;

  return (
    <div>
      <PageHeader
        title={title}
        description="Draft policies can be edited before publishing. After creation you'll be taken to the edit page."
        actions={
          <Link
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            to="/policies"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to policies
          </Link>
        }
      />

      <div className="space-y-3">
        <ErrorAlert message={serverError} />
        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {successMessage}
          </div>
        )}
        {createdCode ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            Policy created. Generated code:{" "}
            <span className="font-mono">{createdCode}</span>
          </div>
        ) : null}
        {policy ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-950">
              {policy.policyCode}
            </span>
            <StatusBadge status={policy.status} />
            {!canEdit ? <span>Only draft policies can be edited.</span> : null}
          </div>
        ) : null}
      </div>

      <form
        className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={handleSubmit(submit)}
      >
        <fieldset disabled={!canEdit || submitting} className="grid gap-5">
          {/* Title */}
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Title</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              {...register("title")}
            />
            {errors.title && (
              <span className="mt-1 block text-xs font-semibold text-rose-600">
                {errors.title.message}
              </span>
            )}
          </label>

          {/* Description */}
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Description
            </span>
            <textarea
              rows="6"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              {...register("description")}
            />
            {errors.description && (
              <span className="mt-1 block text-xs font-semibold text-rose-600">
                {errors.description.message}
              </span>
            )}
          </label>

          {/* Target Regions */}
          <div>
            <span className="text-sm font-semibold text-slate-700">
              Target Regions
            </span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ETHIOPIAN_REGIONS.map((region) => (
                <label
                  key={region}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-700"
                    checked={selectedRegions.includes(region)}
                    onChange={() => toggleRegion(region)}
                  />
                  {region}
                </label>
              ))}
            </div>
            {errors.targetRegions && (
              <span className="mt-1 block text-xs font-semibold text-rose-600">
                {errors.targetRegions.message}
              </span>
            )}
          </div>

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Start Date
              </span>
              <DatePicker
                selected={startDate}
                onChange={(date) =>
                  setValue("startDate", date, { shouldValidate: true })
                }
                selectsStart
                startDate={startDate}
                endDate={endDate}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select start date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
              {errors.startDate && (
                <span className="mt-1 block text-xs font-semibold text-rose-600">
                  {errors.startDate.message}
                </span>
              )}
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                End Date
              </span>
              <DatePicker
                selected={endDate}
                onChange={(date) =>
                  setValue("endDate", date, { shouldValidate: true })
                }
                selectsEnd
                startDate={startDate}
                endDate={endDate}
                minDate={startDate || undefined}
                dateFormat="yyyy-MM-dd"
                placeholderText="Select end date"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
              {errors.endDate && (
                <span className="mt-1 block text-xs font-semibold text-rose-600">
                  {errors.endDate.message}
                </span>
              )}
            </label>
          </div>

          {/* Poll Type */}
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Poll Type
            </span>
            <span
              className="ml-1 cursor-help text-slate-400"
              title="binary: Yes/No vote; multipleChoice: Select one or more options; likert: 5‑point scale; approval: Approve/Reject/Abstain; rating: 1‑5 stars; rankedChoice: Rank up to 3 options."
            >
              ⓘ
            </span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              {...register("pollType")}
            >
              {POLL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          {/* Poll Options Editor (simplified – only text fields) */}
          {["multipleChoice", "rankedChoice"].includes(pollType) && (
            <div>
              <span className="text-sm font-semibold text-slate-700">
                Poll Options
              </span>
              <PollOptionsEditor
                options={watch("pollOptions") || []}
                onChange={(newOptions) =>
                  setValue("pollOptions", newOptions, { shouldValidate: true })
                }
                maxOptions={10}
              />
              {errors.pollOptions && (
                <span className="mt-1 block text-xs font-semibold text-rose-600">
                  {errors.pollOptions.message}
                </span>
              )}
              {pollType === "multipleChoice" && (
                <label className="mt-2 block">
                  <span className="text-sm font-semibold text-slate-700">
                    Max Selections
                  </span>
                  <input
                    type="number"
                    min="1"
                    className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                    {...register("maxSelections")}
                  />
                </label>
              )}
              {pollType === "rankedChoice" && (
                <label className="mt-2 block">
                  <span className="text-sm font-semibold text-slate-700">
                    Max Rank
                  </span>
                  <input
                    type="number"
                    min="1"
                    className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                    {...register("rankedChoiceMaxRank")}
                  />
                </label>
              )}
            </div>
          )}

          {/* Likert Labels */}
          {pollType === "likert" && (
            <div>
              <span className="text-sm font-semibold text-slate-700">
                Likert Labels (5)
              </span>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <input
                    key={idx}
                    type="text"
                    placeholder={`Label ${idx + 1}`}
                    className="rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                    {...register(`likertLabels.${idx}`)}
                  />
                ))}
              </div>
              {errors.likertLabels && (
                <span className="mt-1 block text-xs font-semibold text-rose-600">
                  {errors.likertLabels.message}
                </span>
              )}
            </div>
          )}

          {/* Topics */}
          <div>
            <span className="text-sm font-semibold text-slate-700">Topics</span>
            <TagInput
              tags={topics}
              onChange={(newTopics) =>
                setValue("topics", newTopics, { shouldValidate: true })
              }
              placeholder="Add a topic and press Enter..."
              suggestions={POLICY_TOPICS}
            />
          </div>

          {/* AI Topic Suggestions */}
          <div>
            <button
              type="button"
              onClick={suggestTopics}
              disabled={aiLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-teal-200 px-3 py-2 text-sm font-bold text-teal-700 hover:bg-teal-50 disabled:opacity-50"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lightbulb className="h-4 w-4" />
              )}
              Get AI topic suggestions
            </button>
            {aiError && (
              <p className="mt-1 text-xs font-semibold text-rose-600">
                {aiError}
              </p>
            )}
          </div>
          {aiSuggestions.length > 0 && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-teal-800">
                <Lightbulb className="h-4 w-4" />
                Suggested topics (click to add)
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {aiSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSuggestion(s)}
                    className="rounded-full bg-teal-200 px-3 py-1 text-sm font-semibold text-teal-800 hover:bg-teal-300"
                  >
                    {s}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAiSuggestions([])}
                  className="rounded-full border border-teal-300 px-3 py-1 text-xs text-teal-700 hover:bg-teal-100"
                >
                  Dismiss all
                </button>
              </div>
            </div>
          )}

          {/* Relevance Factors */}
          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-slate-800">
              Relevance Factors
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.keys(emptyValues.relevanceFactors).map((key) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-700"
                    {...register(`relevanceFactors.${key}`)}
                  />
                  {key}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Citizen Analytics Visibility */}
          <fieldset className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-slate-800">
              Citizen Analytics Visibility
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {Object.keys(emptyValues.citizenAnalyticsVisibility).map(
                (key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 text-sm font-semibold text-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-teal-700"
                      {...register(`citizenAnalyticsVisibility.${key}`)}
                    />
                    {key}
                  </label>
                ),
              )}
            </div>
          </fieldset>
        </fieldset>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={!canEdit || submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {submitting
              ? "Saving..."
              : isEdit
                ? "Save changes"
                : "Create policy"}
          </button>
          {isEdit && policy?.status === "draft" && (
            <>
              <button
                type="button"
                onClick={handlePublish}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Rocket className="h-4 w-4" />
                Publish
              </button>
              <button
                type="button"
                onClick={handleClone}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                Clone Draft
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete Draft
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}