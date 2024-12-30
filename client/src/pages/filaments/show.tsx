import { DateField, NumberField, Show, TextField } from "@refinedev/antd";
import { IResourceComponentsProps, useShow, useTranslate } from "@refinedev/core";
import { Button, Typography } from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import React from "react";
import { useNavigate } from "react-router-dom";
import { ExtraFieldDisplay } from "../../components/extraFields";
import { NumberFieldUnit } from "../../components/numberField";
import SpoolIcon from "../../components/spoolIcon";
import { enrichText } from "../../utils/parsing";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { useCurrencyFormatter } from "../../utils/settings";
import { IFilament } from "./model";
dayjs.extend(utc);

const { Title } = Typography;

export const FilamentShow: React.FC<IResourceComponentsProps> = () => {
  const t = useTranslate();
  const navigate = useNavigate();
  const extraFields = useGetFields(EntityType.filament);
  const currencyFormatter = useCurrencyFormatter();
  const { queryResult } = useShow<IFilament>({
    liveMode: "auto",
  });
  const { data, isLoading } = queryResult;

  const record = data?.data;

  const formatTitle = (item: IFilament) => {
    let vendorPrefix = "";
    if (item.vendor) {
      vendorPrefix = `${item.vendor.name} - `;
    }
    return t("filament.titles.show_title", {
      id: item.id,
      name: vendorPrefix + item.name,
      interpolation: { escapeValue: false },
    });
  };

  const gotoVendor = (): undefined => {
    const URL = `/vendor/show/${record?.vendor?.id}`;
    navigate(URL);
  };

  const gotoSpools = (): undefined => {
    const URL = `/spool#filters=[{"field":"filament.id","operator":"in","value":[${record?.id}]}]`;
    navigate(URL);
  };

  const colorObj = record?.multi_color_hexes
    ? {
        colors: record.multi_color_hexes.split(","),
        vertical: record.multi_color_direction === "longitudinal",
      }
    : record?.color_hex;

  return (
    <Show
      isLoading={isLoading}
      title={record ? formatTitle(record) : ""}
      headerButtons={({ defaultButtons }) => (
        <>
          <Button type="primary" onClick={gotoSpools}>
            {t("filament.fields.spools")}
          </Button>
          {defaultButtons}
        </>
      )}
    >
      <Title level={5}>{t("filament.fields.id")}</Title>
      <NumberField value={record?.id ?? ""} />
      <Title level={5}>{t("filament.fields.vendor")}</Title>
      <button
        onClick={gotoVendor}
        style={{ background: "none", border: "none", color: "blue", cursor: "pointer", paddingLeft: 0 }}
      >
        {record ? record.vendor?.name : ""}
      </button>
      <Title level={5}>{t("filament.fields.registered")}</Title>
      <DateField
        value={dayjs.utc(record?.registered).local()}
        title={dayjs.utc(record?.registered).local().format()}
        format="YYYY-MM-DD HH:mm:ss"
      />
      <Title level={5}>{t("filament.fields.name")}</Title>
      <TextField value={record?.name} />
      <Title level={5}>{t("filament.fields.color_hex")}</Title>
      {colorObj && <SpoolIcon color={colorObj} size="large" />}
      <Title level={5}>{t("filament.fields.material")}</Title>
      <TextField value={record?.material} />
      <Title level={5}>{t("filament.fields.price")}</Title>
      <TextField value={record?.price ? currencyFormatter.format(record.price) : ""} />
      <Title level={5}>{t("filament.fields.density")}</Title>
      <NumberFieldUnit
        value={record?.density ?? ""}
        unit="g/cm³"
        options={{
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }}
      />
      <Title level={5}>{t("filament.fields.diameter")}</Title>
      <NumberFieldUnit
        value={record?.diameter ?? ""}
        unit="mm"
        options={{
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }}
      />
      <Title level={5}>{t("filament.fields.weight")}</Title>
      <NumberFieldUnit
        value={record?.weight ?? ""}
        unit="g"
        options={{
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }}
      />
      <Title level={5}>{t("filament.fields.spool_weight")}</Title>
      <NumberFieldUnit
        value={record?.spool_weight ?? ""}
        unit="g"
        options={{
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        }}
      />
      <Title level={5}>{t("filament.fields.settings_extruder_temp")}</Title>
      {!record?.settings_extruder_temp ? (
        <TextField value="Not Set" />
      ) : (
        <NumberFieldUnit value={record?.settings_extruder_temp ?? ""} unit="°C" />
      )}
      <Title level={5}>{t("filament.fields.settings_bed_temp")}</Title>
      {!record?.settings_bed_temp ? (
        <TextField value="Not Set" />
      ) : (
        <NumberFieldUnit value={record?.settings_bed_temp ?? ""} unit="°C" />
      )}
      <Title level={5}>{t("filament.fields.article_number")}</Title>
      <TextField value={record?.article_number} />
      <Title level={5}>{t("filament.fields.external_id")}</Title>
      <TextField value={record?.external_id} />
      <Title level={5}>{t("filament.fields.comment")}</Title>
      <TextField value={enrichText(record?.comment)} />
      <Title level={4}>{t("settings.extra_fields.tab")}</Title>
      {extraFields?.data?.map((field, index) => (
        <ExtraFieldDisplay key={index} field={field} value={record?.extra[field.key]} />
      ))}
    </Show>
  );
};

export default FilamentShow;
