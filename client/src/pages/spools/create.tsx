import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { Create, useForm } from "@refinedev/antd";
import { HttpError, IResourceComponentsProps, useTranslate } from "@refinedev/core";
import { Alert, Button, DatePicker, Divider, Form, Input, InputNumber, Radio, Select, Typography } from "antd";
import TextArea from "antd/es/input/TextArea";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useEffect, useMemo, useState } from "react";
import { ExtraFieldFormItem, ParsedExtras, StringifiedExtras } from "../../components/extraFields";
import { useSpoolmanLocations } from "../../components/otherModels";
import { searchMatches } from "../../utils/filtering";
import "../../utils/overrides.css";
import { numberFormatter, numberParser, numberParserAllowEmpty } from "../../utils/parsing";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { getCurrencySymbol, useCurrency } from "../../utils/settings";
import { createFilamentFromExternal } from "../filaments/functions";
import { useGetFilamentSelectOptions } from "./functions";
import { ISpool, ISpoolParsedExtras, WeightToEnter } from "./model";

dayjs.extend(utc);

interface CreateOrCloneProps {
  mode: "create" | "clone";
}

type ISpoolRequest = Omit<ISpoolParsedExtras, "id" | "registered"> & {
  filament_id: number | string;
};

export const SpoolCreate: React.FC<IResourceComponentsProps & CreateOrCloneProps> = (props) => {
  const t = useTranslate();
  const extraFields = useGetFields(EntityType.spool);
  const currency = useCurrency();

  const { form, formProps, formLoading, onFinish, redirect } = useForm<
    ISpool,
    HttpError,
    ISpoolRequest,
    ISpoolParsedExtras
  >({
    redirect: false,
    warnWhenUnsavedChanges: false,
  });
  if (!formProps.initialValues) {
    formProps.initialValues = {};
  }

  const initialWeightValue = Form.useWatch("initial_weight", form);
  const spoolWeightValue = Form.useWatch("spool_weight", form);

  if (props.mode === "clone") {
    // Clear out the values that we don't want to clone
    formProps.initialValues.first_used = null;
    formProps.initialValues.last_used = null;
    formProps.initialValues.used_weight = 0;

    // Fix the filament_id
    if (formProps.initialValues.filament) {
      formProps.initialValues.filament_id = formProps.initialValues.filament.id;
    }

    // Parse the extra fields from string values into real types
    formProps.initialValues = ParsedExtras(formProps.initialValues);
  }

  // If the query variable filament_id is set, set the filament_id field to that value
  const query = new URLSearchParams(window.location.search);
  const filament_id = query.get("filament_id");
  if (filament_id) {
    formProps.initialValues.filament_id = parseInt(filament_id);
  }

  //
  // Set up the filament selection options
  //
  const {
    options: filamentOptions,
    internalSelectOptions,
    externalSelectOptions,
    allExternalFilaments,
  } = useGetFilamentSelectOptions(currency);

  const selectedFilamentID = Form.useWatch("filament_id", form);
  const selectedFilament = useMemo(() => {
    // id is a number of it's an internal filament, and a string of it's an external filament.
    if (typeof selectedFilamentID === "number") {
      return (
        internalSelectOptions?.find((obj) => {
          return obj.value === selectedFilamentID;
        }) ?? null
      );
    } else if (typeof selectedFilamentID === "string") {
      return (
        externalSelectOptions?.find((obj) => {
          return obj.value === selectedFilamentID;
        }) ?? null
      );
    } else {
      return null;
    }
  }, [selectedFilamentID, internalSelectOptions, externalSelectOptions]);

  //
  // Submit handler
  //

  const handleSubmit = async (redirectTo: "list" | "edit" | "create") => {
    const values = StringifiedExtras(await form.validateFields());
    if (selectedFilament?.is_internal === false) {
      // Filament ID being a string indicates its an external filament.
      // If so, we should first create the internal filament version, then create the spool(s)
      const externalFilament = allExternalFilaments?.find((f) => f.id === values.filament_id);
      if (!externalFilament) {
        throw new Error("Unknown external filament");
      }
      const internalFilament = await createFilamentFromExternal(externalFilament);
      values.filament_id = internalFilament.id;
    }

    if (quantity > 1) {
      const submit = Array(quantity).fill(values);
      // queue multiple creates this way for now Refine doesn't seem to map Arrays to createMany or multiple creates like it says it does
      submit.forEach(async (r) => await onFinish(r));
    } else {
      await onFinish(values);
    }

    redirect(redirectTo);
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

  //
  // Weight calculations
  //

  const [weightToEnter, setWeightToEnter] = useState(1);
  const [usedWeight, setUsedWeight] = useState(0);

  useEffect(() => {
    const newFilamentPrice = selectedFilament?.price || 0;
    const newFilamentWeight = selectedFilament?.weight || 0;
    const newSpoolWeight = selectedFilament?.spool_weight || 0;
    if (newFilamentPrice > 0) {
      form.setFieldValue("price", newFilamentPrice);
    }
    if (newFilamentWeight > 0) {
      form.setFieldValue("initial_weight", newFilamentWeight);
    }
    if (newSpoolWeight > 0) {
      form.setFieldValue("spool_weight", newSpoolWeight);
    }
  }, [selectedFilament]);

  const weightChange = (weight: number) => {
    setUsedWeight(weight);
    form.setFieldsValue({
      used_weight: weight,
    });
  };

  const locations = useSpoolmanLocations(true);
  const [newLocation, setNewLocation] = useState("");

  const allLocations = [...(locations.data || [])];
  if (newLocation.trim() && !allLocations.includes(newLocation)) {
    allLocations.push(newLocation.trim());
  }

  const [quantity, setQuantity] = useState(1);
  const incrementQty = () => {
    setQuantity(quantity + 1);
  };

  const decrementQty = () => {
    setQuantity(quantity - 1);
  };

  const getSpoolWeight = (): number => {
    return spoolWeightValue ?? selectedFilament?.spool_weight ?? 0;
  };

  const getFilamentWeight = (): number => {
    return initialWeightValue ?? selectedFilament?.weight ?? 0;
  };

  const getGrossWeight = (): number => {
    const net_weight = getFilamentWeight();
    const spool_weight = getSpoolWeight();
    return net_weight + spool_weight;
  };

  const getMeasuredWeight = (): number => {
    const grossWeight = getGrossWeight();

    return grossWeight - usedWeight;
  };

  const getRemainingWeight = (): number => {
    const initial_weight = getFilamentWeight();

    return initial_weight - usedWeight;
  };

  const isMeasuredWeightEnabled = (): boolean => {
    if (!isRemainingWeightEnabled()) {
      return false;
    }

    const spool_weight = spoolWeightValue;

    return spool_weight || selectedFilament?.spool_weight ? true : false;
  };

  const isRemainingWeightEnabled = (): boolean => {
    const initial_weight = initialWeightValue;

    if (initial_weight) {
      return true;
    }

    return selectedFilament?.weight ? true : false;
  };

  useEffect(() => {
    if (weightToEnter >= WeightToEnter.measured_weight) {
      if (!isMeasuredWeightEnabled()) {
        setWeightToEnter(WeightToEnter.remaining_weight);
        return;
      }
    }
    if (weightToEnter >= WeightToEnter.remaining_weight) {
      if (!isRemainingWeightEnabled()) {
        setWeightToEnter(WeightToEnter.used_weight);
        return;
      }
    }
  }, [selectedFilament]);

  return (
    <Create
      title={props.mode === "create" ? t("spool.titles.create") : t("spool.titles.clone")}
      isLoading={formLoading}
      footerButtons={() => (
        <>
          <div
            style={{ display: "flex", backgroundColor: "#141414", border: "1px solid #424242", borderRadius: "6px" }}
          >
            <Button type="text" style={{ padding: 0, width: 32, height: 32 }} onClick={decrementQty}>
              <MinusOutlined />
            </Button>
            <InputNumber name="Quantity" min={1} id="qty-input" controls={false} value={quantity}></InputNumber>
            <Button type="text" style={{ padding: 0, width: 32, height: 32 }} onClick={incrementQty}>
              <PlusOutlined />
            </Button>
          </div>
          <Button type="primary" onClick={() => handleSubmit("list")}>
            {t("buttons.save")}
          </Button>
          <Button type="primary" onClick={() => handleSubmit("create")}>
            {t("buttons.saveAndAdd")}
          </Button>
        </>
      )}
    >
      <Form {...formProps} layout="vertical">
        <Form.Item
          label={t("spool.fields.first_used")}
          name={["first_used"]}
          rules={[
            {
              required: false,
            },
          ]}
          getValueProps={(value) => ({
            value: value ? dayjs(value) : undefined,
          })}
        >
          <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" />
        </Form.Item>
        <Form.Item
          label={t("spool.fields.last_used")}
          name={["last_used"]}
          rules={[
            {
              required: false,
            },
          ]}
          getValueProps={(value) => ({
            value: value ? dayjs(value) : undefined,
          })}
        >
          <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" />
        </Form.Item>
        <Form.Item
          label={t("spool.fields.filament")}
          name={["filament_id"]}
          rules={[
            {
              required: true,
            },
          ]}
        >
          <Select
            options={filamentOptions}
            showSearch
            filterOption={(input, option) => typeof option?.label === "string" && searchMatches(input, option?.label)}
          />
        </Form.Item>
        {selectedFilament?.is_internal === false && (
          <Alert message={t("spool.fields_help.external_filament")} type="info" />
        )}
        <Form.Item
          label={t("spool.fields.price")}
          help={t("spool.fields_help.price")}
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
          label={t("spool.fields.initial_weight")}
          help={t("spool.fields_help.initial_weight")}
          name={["initial_weight"]}
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
          label={t("spool.fields.spool_weight")}
          help={t("spool.fields_help.spool_weight")}
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

        <Form.Item hidden={true} name={["used_weight"]} initialValue={0}>
          <InputNumber value={usedWeight} />
        </Form.Item>

        <Form.Item label={t("spool.fields.weight_to_use")} help={t("spool.fields_help.weight_to_use")}>
          <Radio.Group
            onChange={(value) => {
              setWeightToEnter(value.target.value);
            }}
            defaultValue={WeightToEnter.used_weight}
            value={weightToEnter}
          >
            <Radio.Button value={WeightToEnter.used_weight}>{t("spool.fields.used_weight")}</Radio.Button>
            <Radio.Button value={WeightToEnter.remaining_weight} disabled={!isRemainingWeightEnabled()}>
              {t("spool.fields.remaining_weight")}
            </Radio.Button>
            <Radio.Button value={WeightToEnter.measured_weight} disabled={!isMeasuredWeightEnabled()}>
              {t("spool.fields.measured_weight")}
            </Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item label={t("spool.fields.used_weight")} help={t("spool.fields_help.used_weight")} initialValue={0}>
          <InputNumber
            min={0}
            addonAfter="g"
            precision={1}
            formatter={numberFormatter}
            parser={numberParser}
            disabled={weightToEnter != WeightToEnter.used_weight}
            value={usedWeight}
            onChange={(value) => {
              weightChange(value ?? 0);
            }}
          />
        </Form.Item>
        <Form.Item
          label={t("spool.fields.remaining_weight")}
          help={t("spool.fields_help.remaining_weight")}
          initialValue={0}
        >
          <InputNumber
            min={0}
            addonAfter="g"
            precision={1}
            formatter={numberFormatter}
            parser={numberParser}
            disabled={weightToEnter != WeightToEnter.remaining_weight}
            value={getRemainingWeight()}
            onChange={(value) => {
              weightChange(getFilamentWeight() - (value ?? 0));
            }}
          />
        </Form.Item>
        <Form.Item
          label={t("spool.fields.measured_weight")}
          help={t("spool.fields_help.measured_weight")}
          initialValue={0}
        >
          <InputNumber
            min={0}
            addonAfter="g"
            precision={1}
            formatter={numberFormatter}
            parser={numberParser}
            disabled={weightToEnter != WeightToEnter.measured_weight}
            value={getMeasuredWeight()}
            onChange={(value) => {
              const totalWeight = getGrossWeight();
              weightChange(totalWeight - (value ?? 0));
            }}
          />
        </Form.Item>
        <Form.Item
          label={t("spool.fields.location")}
          help={t("spool.fields_help.location")}
          name={["location"]}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <Select
            dropdownRender={(menu) => (
              <>
                {menu}
                <Divider style={{ margin: "8px 0" }} />
                <Input
                  placeholder={t("spool.form.new_location_prompt")}
                  value={newLocation}
                  onChange={(event) => setNewLocation(event.target.value)}
                />
              </>
            )}
            loading={locations.isLoading}
            options={allLocations.map((item) => ({ label: item, value: item }))}
          />
        </Form.Item>
        <Form.Item
          label={t("spool.fields.lot_nr")}
          help={t("spool.fields_help.lot_nr")}
          name={["lot_nr"]}
          rules={[
            {
              required: false,
            },
          ]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item
          label={t("spool.fields.comment")}
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

export default SpoolCreate;
