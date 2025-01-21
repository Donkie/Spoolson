import { Create, useForm, useSelect } from "@refinedev/antd";
import { HttpError, IResourceComponentsProps, useInvalidate, useTranslate } from "@refinedev/core";
import { Button, ColorPicker, Form, Input, InputNumber, Radio, Select, Typography } from "antd";
import TextArea from "antd/es/input/TextArea";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useEffect, useState } from "react";
import { ExtraFieldFormItem, ParsedExtras, StringifiedExtras } from "../../components/extraFields";
import { FilamentImportModal } from "../../components/filamentImportModal";
import { MultiColorPicker } from "../../components/multiColorPicker";
import { numberFormatter, numberParser, numberParserAllowEmpty } from "../../utils/parsing";
import { ExternalFilament } from "../../utils/queryExternalDB";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { getCurrencySymbol, useCurrency } from "../../utils/settings";
import { getOrCreateVendorFromExternal } from "../vendors/functions";
import { IVendor } from "../vendors/model";
import { IFilament, IFilamentParsedExtras } from "./model";

dayjs.extend(utc);

interface CreateOrCloneProps {
  mode: "create" | "clone";
}

type IFilamentRequest = Omit<IFilamentParsedExtras, "id" | "registered"> & {
  vendor_id: number;
};

export const FilamentCreate: React.FC<IResourceComponentsProps & CreateOrCloneProps> = (props) => {
  const t = useTranslate();
  const extraFields = useGetFields(EntityType.filament);
  const currency = useCurrency();
  const [isImportExtOpen, setIsImportExtOpen] = useState(false);
  const invalidate = useInvalidate();
  const [colorType, setColorType] = useState<"single" | "multi">("single");

  const { form, formProps, formLoading, onFinish, redirect } = useForm<
    IFilament,
    HttpError,
    IFilamentRequest,
    IFilamentParsedExtras
  >();

  if (!formProps.initialValues) {
    formProps.initialValues = {};
  }

  if (props.mode === "clone") {
    // Fix the vendor_id
    if (formProps.initialValues.vendor) {
      formProps.initialValues.vendor_id = formProps.initialValues.vendor.id;
    }

    // Parse the extra fields from string values into real types
    formProps.initialValues = ParsedExtras(formProps.initialValues);
  }

  const handleSubmit = async (redirectTo: "list" | "create") => {
    const values = StringifiedExtras(await form.validateFields());
    await onFinish(values);
    redirect(redirectTo);
  };

  const { selectProps: vendorSelect } = useSelect<IVendor>({
    resource: "vendor",
    optionLabel: "name",
  });

  const importFilament = async (filament: ExternalFilament) => {
    const vendor = await getOrCreateVendorFromExternal(filament.manufacturer);
    await invalidate({
      resource: "vendor",
      invalidates: ["list", "detail"],
    });

    setColorType(filament.color_hexes ? "multi" : "single");

    form.setFieldsValue({
      name: filament.name,
      vendor_id: vendor.id,
      material: filament.material,
      price: filament.price,
      density: filament.density,
      diameter: filament.diameter,
      weight: filament.weight,
      spool_weight: filament.spool_weight || undefined,
      color_hex: filament.color_hex,
      multi_color_hexes: filament.color_hexes?.join(",") || undefined,
      multi_color_direction: filament.multi_color_direction,
      settings_extruder_temp: filament.extruder_temp || undefined,
      settings_bed_temp: filament.bed_temp || undefined,
    });
  };

  // Use useEffect to update the form's initialValues when the extra fields are loaded
  // This is necessary because the form is rendered before the extra fields are loaded
  useEffect(() => {
    extraFields.data?.forEach((field) => {
      if (formProps.initialValues && field.default_value) {
        const parsedValue = JSON.parse(field.default_value as string);
        form.setFieldsValue({ extra: { [field.key]: parsedValue } });
      }
    });
  }, [form, extraFields.data, formProps.initialValues]);

  return (
    <Create
      title={props.mode === "create" ? t("filament.titles.create") : t("filament.titles.clone")}
      isLoading={formLoading}
      headerButtons={() => (
        <>
          <Button type="primary" onClick={() => setIsImportExtOpen(true)}>
            {t("filament.form.import_external")}
          </Button>
        </>
      )}
      footerButtons={() => (
        <>
          <Button type="primary" onClick={() => handleSubmit("list")}>
            {t("buttons.save")}
          </Button>
          <Button type="primary" onClick={() => handleSubmit("create")}>
            {t("buttons.saveAndAdd")}
          </Button>
        </>
      )}
    >
      <FilamentImportModal
        isOpen={isImportExtOpen}
        onImport={(value) => {
          setIsImportExtOpen(false);
          importFilament(value);
        }}
        onClose={() => setIsImportExtOpen(false)}
      />
      <Form {...formProps} layout="vertical">
        <Form.Item
          label={t("filament.fields.name")}
          help={t("filament.fields_help.name")}
          name={["name"]}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.vendor")}
          name={["vendor_id"]}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <Select
            {...vendorSelect}
            allowClear
            filterSort={(a, b) => {
              return a?.label && b?.label
                ? (a.label as string).localeCompare(b.label as string, undefined, { sensitivity: "base" })
                : 0;
            }}
            filterOption={(input, option) =>
              typeof option?.label === "string" && option?.label.toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item label={t("filament.fields.color_hex")}>
          <Radio.Group
            onChange={(value) => {
              setColorType(value.target.value);
            }}
            defaultValue={colorType}
            value={colorType}
          >
            <Radio.Button value={"single"}>{t("filament.fields.single_color")}</Radio.Button>
            <Radio.Button value={"multi"}>{t("filament.fields.multi_color")}</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {colorType == "single" && (
          <Form.Item
            name={"color_hex"}
            rules={[
              {
                required: false,
              },
            ]}
            getValueFromEvent={(e) => {
              return e?.toHex();
            }}
          >
            <ColorPicker format="hex" />
          </Form.Item>
        )}
        {colorType == "multi" && (
          <Form.Item
            name={"multi_color_direction"}
            help={t("filament.fields_help.multi_color_direction")}
            rules={[
              {
                required: true,
              },
            ]}
            initialValue={"coaxial"}
          >
            <Radio.Group>
              <Radio.Button value={"coaxial"}>{t("filament.fields.coaxial")}</Radio.Button>
              <Radio.Button value={"longitudinal"}>{t("filament.fields.longitudinal")}</Radio.Button>
            </Radio.Group>
          </Form.Item>
        )}
        {colorType == "multi" && (
          <Form.Item
            name={"multi_color_hexes"}
            rules={[
              {
                required: false,
              },
            ]}
          >
            <MultiColorPicker min={2} max={14} />
          </Form.Item>
        )}
        <Form.Item
          label={t("filament.fields.material")}
          help={t("filament.fields_help.material")}
          name={["material"]}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.price")}
          help={t("filament.fields_help.price")}
          name={["price"]}
          rules={[
            {
              required: false,
              type: "number",
              min: 0,
            },
          ]}
        >
          <InputNumber
            addonAfter={getCurrencySymbol(undefined, currency)}
            precision={2}
            formatter={numberFormatter}
            parser={numberParserAllowEmpty}
          />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.density")}
          name={["density"]}
          rules={[
            {
              required: true,
              type: "number",
              min: 0,
              max: 100,
            },
          ]}
        >
          <InputNumber addonAfter="g/cm³" precision={2} formatter={numberFormatter} parser={numberParser} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.diameter")}
          name={["diameter"]}
          rules={[
            {
              required: true,
              type: "number",
              min: 0,
              max: 10,
            },
          ]}
        >
          <InputNumber addonAfter="mm" precision={2} formatter={numberFormatter} parser={numberParser} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.weight")}
          help={t("filament.fields_help.weight")}
          name={["weight"]}
          rules={[
            {
              required: false,
              type: "number",
              min: 0,
            },
          ]}
        >
          <InputNumber addonAfter="g" precision={1} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.spool_weight")}
          help={t("filament.fields_help.spool_weight")}
          name={["spool_weight"]}
          rules={[
            {
              required: false,
              type: "number",
              min: 0,
            },
          ]}
        >
          <InputNumber addonAfter="g" precision={1} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.settings_extruder_temp")}
          name={["settings_extruder_temp"]}
          rules={[
            {
              required: false,
              type: "number",
              min: 0,
            },
          ]}
        >
          <InputNumber addonAfter="°C" precision={0} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.settings_bed_temp")}
          name={["settings_bed_temp"]}
          rules={[
            {
              required: false,
              type: "number",
              min: 0,
            },
          ]}
        >
          <InputNumber addonAfter="°C" precision={0} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.article_number")}
          help={t("filament.fields_help.article_number")}
          name={["article_number"]}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item
          label={t("filament.fields.comment")}
          name={["comment"]}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <TextArea maxLength={1024} />
        </Form.Item>
        <Typography.Title level={5}>{t("settings.extra_fields.tab")}</Typography.Title>
        {extraFields.data?.map((field, index) => (
          <ExtraFieldFormItem key={index} field={field} />
        ))}
      </Form>
    </Create>
  );
};

export default FilamentCreate;
