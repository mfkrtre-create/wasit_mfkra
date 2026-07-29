"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import {
  priceTypes,
  propertySchema,
  propertyTypes,
  recordTypes,
  transactionTypes,
  type PropertyData,
} from "@/lib/property-schema";

type FieldName = keyof PropertyData;

const labels: Record<FieldName, string> = {
  recordType: "نوع السجل",
  transactionType: "نوع العملية",
  propertyType: "نوع العقار",
  city: "المدينة",
  districts: "الأحياء",
  area: "المساحة",
  streetWidth: "عرض الشارع",
  facade: "الواجهة",
  price: "السعر",
  maximumBudget: "الميزانية القصوى",
  priceType: "نوع السعر",
  bedrooms: "غرف النوم",
  minimumBedrooms: "الحد الأدنى للغرف",
  bathrooms: "دورات المياه",
  licenseNumber: "رقم ترخيص الإعلان",
  contactNumber: "رقم التواصل",
  description: "الوصف",
  missingFields: "الحقول الناقصة",
  confidence: "نسبة الثقة",
};

const enumLabels: Record<string, string> = {
  offer: "عرض",
  request: "طلب",
  sale: "بيع",
  rent: "إيجار",
  buy: "شراء",
  rent_request: "طلب إيجار",
  residential_land: "أرض سكنية",
  commercial_land: "أرض تجارية",
  villa: "فيلا",
  apartment: "شقة",
  building: "عمارة",
  farm: "مزرعة",
  office: "مكتب",
  warehouse: "مستودع",
  other: "أخرى",
  net: "صافي",
  negotiable: "قابل للتفاوض",
  unknown: "غير محدد",
};

function splitArabicList(value: string) {
  return value
    .split(/[\n,،]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function PropertyForm({
  data,
  originalText,
  autoFilledFields,
}: {
  data: PropertyData;
  originalText: string;
  autoFilledFields: FieldName[];
}) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PropertyData>({
    resolver: zodResolver(propertySchema),
    values: data,
    mode: "onChange",
  });
  const [approvedJson, setApprovedJson] = useState<string | null>(null);
  const autoFilled = new Set<FieldName>(autoFilledFields);
  const missingFields = useWatch({ control, name: "missingFields" }) ?? [];
  const confidence = useWatch({ control, name: "confidence" }) ?? 0;

  function fieldClass(name: FieldName) {
    return [
      "rounded-lg border bg-white p-3 shadow-sm",
      autoFilled.has(name) ? "border-teal-300 ring-2 ring-teal-500/10" : "border-slate-200",
    ].join(" ");
  }

  function inputClass(hasError: boolean) {
    return [
      "mt-2 h-11 w-full rounded-md border bg-slate-50 px-3 text-slate-950 outline-none transition focus:bg-white focus:ring-2",
      hasError ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20" : "border-slate-300 focus:border-teal-700 focus:ring-teal-600/20",
    ].join(" ");
  }

  function renderTextField(name: FieldName) {
    return (
      <div className={fieldClass(name)}>
        <label className="text-sm font-bold text-slate-800">{labels[name]}</label>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <input
              value={typeof field.value === "string" ? field.value : ""}
              onChange={(event) => field.onChange(event.target.value.trim() || null)}
              className={inputClass(Boolean(errors[name]))}
            />
          )}
        />
        {errors[name] ? <p className="mt-1 text-xs text-rose-700">القيمة غير صالحة.</p> : null}
      </div>
    );
  }

  function renderNumberField(name: FieldName) {
    return (
      <div className={fieldClass(name)}>
        <label className="text-sm font-bold text-slate-800">{labels[name]}</label>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <input
              type="number"
              min="0"
              value={typeof field.value === "number" ? field.value : ""}
              onChange={(event) => field.onChange(event.target.value === "" ? null : Number(event.target.value))}
              className={inputClass(Boolean(errors[name]))}
            />
          )}
        />
        {errors[name] ? <p className="mt-1 text-xs text-rose-700">أدخل رقماً صحيحاً.</p> : null}
      </div>
    );
  }

  function renderSelectField(name: FieldName, options: readonly string[], allowEmpty = true) {
    return (
      <div className={fieldClass(name)}>
        <label className="text-sm font-bold text-slate-800">{labels[name]}</label>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <select
              value={typeof field.value === "string" ? field.value : ""}
              onChange={(event) => field.onChange(event.target.value || null)}
              className={inputClass(Boolean(errors[name]))}
            >
              {allowEmpty ? <option value="">غير معروف</option> : null}
              {options.map((option) => (
                <option key={option} value={option}>
                  {enumLabels[option]}
                </option>
              ))}
            </select>
          )}
        />
        {errors[name] ? <p className="mt-1 text-xs text-rose-700">اختر قيمة صحيحة.</p> : null}
      </div>
    );
  }

  function approve(values: PropertyData) {
    setApprovedJson(JSON.stringify(values, null, 2));
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white/85 p-4 shadow-sm">
      <div className="mb-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-2 text-lg font-bold text-slate-950">النص الأصلي</h2>
          <p className="whitespace-pre-wrap leading-8 text-slate-700">{originalText}</p>
        </div>
        <div className="grid gap-3">
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm font-bold text-teal-950">{labels.confidence}</p>
            <p className="mt-2 text-3xl font-black text-teal-800">{Math.round(confidence * 100)}%</p>
          </div>
          {missingFields.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <div className="mb-2 flex items-center gap-2 font-bold">
                <CircleAlert className="size-5" aria-hidden="true" />
                حقول تحتاج مراجعة
              </div>
              <p className="text-sm leading-7">{missingFields.join("، ")}</p>
            </div>
          ) : null}
        </div>
      </div>

      <form onSubmit={handleSubmit(approve)} className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {renderSelectField("recordType", recordTypes, false)}
          {renderSelectField("transactionType", transactionTypes)}
          {renderSelectField("propertyType", propertyTypes)}
          {renderTextField("city")}
          <div className={fieldClass("districts")}>
            <label className="text-sm font-bold text-slate-800">{labels.districts}</label>
            <Controller
              control={control}
              name="districts"
              render={({ field }) => (
                <textarea
                  value={Array.isArray(field.value) ? field.value.join("، ") : ""}
                  onChange={(event) => field.onChange(splitArabicList(event.target.value))}
                  rows={2}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-slate-950 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-2 focus:ring-teal-600/20"
                />
              )}
            />
          </div>
          {renderNumberField("area")}
          {renderNumberField("streetWidth")}
          {renderTextField("facade")}
          {renderNumberField("price")}
          {renderNumberField("maximumBudget")}
          {renderSelectField("priceType", priceTypes)}
          {renderNumberField("bedrooms")}
          {renderNumberField("minimumBedrooms")}
          {renderNumberField("bathrooms")}
          {renderTextField("licenseNumber")}
          {renderTextField("contactNumber")}
          <div className={fieldClass("confidence")}>
            <label className="text-sm font-bold text-slate-800">{labels.confidence}</label>
            <Controller
              control={control}
              name="confidence"
              render={({ field }) => (
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={typeof field.value === "number" ? field.value : 0}
                  onChange={(event) => field.onChange(Number(event.target.value))}
                  className={inputClass(Boolean(errors.confidence))}
                />
              )}
            />
          </div>
        </div>

        <div className={fieldClass("description")}>
          <label className="text-sm font-bold text-slate-800">{labels.description}</label>
          <Controller
            control={control}
            name="description"
            render={({ field }) => (
              <textarea
                value={typeof field.value === "string" ? field.value : ""}
                onChange={(event) => field.onChange(event.target.value.trim() || null)}
                rows={3}
                className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 leading-7 text-slate-950 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-2 focus:ring-teal-600/20"
              />
            )}
          />
        </div>

        <div className={fieldClass("missingFields")}>
          <label className="text-sm font-bold text-slate-800">{labels.missingFields}</label>
          <Controller
            control={control}
            name="missingFields"
            render={({ field }) => (
              <textarea
                value={Array.isArray(field.value) ? field.value.join("، ") : ""}
                onChange={(event) => field.onChange(splitArabicList(event.target.value))}
                rows={2}
                className="mt-2 w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 leading-7 text-slate-950 outline-none transition focus:border-teal-700 focus:bg-white focus:ring-2 focus:ring-teal-600/20"
              />
            )}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <CheckCircle2 className="size-5" aria-hidden="true" />
            اعتماد البيانات
          </button>
        </div>
      </form>

      {approvedJson ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="mb-2 font-bold text-teal-950">تم اعتماد البيانات بنجاح</p>
          <pre className="max-h-96 overflow-auto rounded-md bg-slate-950 p-4 text-left text-sm text-slate-50" dir="ltr">
            {approvedJson}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
