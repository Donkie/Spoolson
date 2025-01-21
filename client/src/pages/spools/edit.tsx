import { Edit, useForm } from "@refinedev/antd";
import { HttpError, IResourceComponentsProps, useTranslate } from "@refinedev/core";
import { Alert, DatePicker, Divider, Form, Input, InputNumber, Radio, Select, Typography } from "antd";
import TextArea from "antd/es/input/TextArea";
import { message } from "antd/lib";
import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExtraFieldFormItem, ParsedExtras, StringifiedExtras } from "../../components/extraFields";
import { useSpoolmanLocations } from "../../components/otherModels";
import { searchMatches } from "../../utils/filtering";
import { numberFormatter, numberParser, numberParserAllowEmpty } from "../../utils/parsing";
import { EntityType, useGetFields } from "../../utils/queryFields";
import { getCurrencySymbol, useCurrency } from "../../utils/settings";
import { createFilamentFromExternal } from "../filaments/functions";
import { useLocations } from "../locations/functions";
import { useGetFilamentSelectOptions } from "./functions";
import { ISpool, ISpoolParsedExtras, WeightToEnter } from "./model";

/*
The API returns the extra fields as JSON values, but we need to parse them into their real types
in order for Ant design's form to work properly. ParsedExtras does this for us.
We also need to stringify them again before sending them back to the API, which is done by overriding
the form's onFinish method. Form.Item's normalize should do this, but it doesn't seem to work.
*/

type ISpoolRequest = ISpoolParsedExtras & {
  filament_id: number | string;
};

export const SpoolEdit: React.FC<IResourceComponentsProps> = () => {
  const t = useTranslate();
  const [messageApi, contextHolder] = message.useMessage();
  const [hasChanged, setHasChanged] = useState(false);
  const extraFields = useGetFields(EntityType.spool);
  const currency = useCurrency();
  const [searchParams, _] = useSearchParams();
  const navigate = useNavigate();

  const { form, formProps, saveButtonProps } = useForm<ISpool, HttpError, ISpoolRequest, ISpool>({
    liveMode: "manual",
    onLiveEvent() {
      // Warn the user if the spool has been updated since the form was opened
      messageApi.warning(t("spool.form.spool_updated"));
      setHasChanged(true);
    },

    // Custom redirect logic
    redirect: false,
    onMutationSuccess: () => {
      const returnUrl = searchParams.get("return");
      if (returnUrl) {
        navigate(returnUrl, { relative: "path" });
      } else {
        navigate("/spool");
      }
    },
  });

  const initialWeightValue = Form.useWatch("initial_weight", form);
  const spoolWeightValue = Form.useWatch("spool_weight", form);

  // Add the filament_id field to the form
  if (formProps.initialValues) {
    formProps.initialValues["filament_id"] = formProps.initialValues["filament"].id;

    // Parse the extra fields from string values into real types
    formProps.initialValues = ParsedExtras(formProps.initialValues);
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

  // Override the form's onFinish method to stringify the extra fields
  const originalOnFinish = formProps.onFinish;
  formProps.onFinish = (allValues: ISpoolRequest) => {
    if (allValues !== undefined && allValues !== null) {
      // Lot of stupidity here to make types work
      const values = StringifiedExtras<ISpoolRequest>(allValues);
      if (selectedFilament?.is_internal === false) {
        // Filament ID being a string indicates its an external filament.
        // If so, we should first create the internal filament version, then edit the spool
        const externalFilament = allExternalFilaments?.find((f) => f.id === values.filament_id);
        if (!externalFilament) {
          throw new Error("Unknown external filament");
        }
        createFilamentFromExternal(externalFilament).then((internalFilament) => {
          values.filament_id = internalFilament.id;
          originalOnFinish?.({
            extra: {},
            ...values,
          });
        });
      } else {
        originalOnFinish?.({
          extra: {},
          ...values,
        });
      }
    }
  };

  const [weightToEnter, setWeightToEnter] = useState(1);
  const [usedWeight, setUsedWeight] = useState(0);

  useEffect(() => {
    const newFilamentWeight = selectedFilament?.weight || 0;
    const newSpoolWeight = selectedFilament?.spool_weight || 0;
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
  const settingsLocation = useLocations();
  const [newLocation, setNewLocation] = useState("");

  const allLocations = [...(settingsLocation || [])];
  locations?.data?.forEach((loc) => {
    if (!allLocations.includes(loc)) {
      allLocations.push(loc);
    }
  });
  if (newLocation.trim() && !allLocations.includes(newLocation)) {
    allLocations.push(newLocation.trim());
  }

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

  const initialUsedWeight = formProps.initialValues?.used_weight || 0;
  useEffect(() => {
    if (initialUsedWeight) {
      setUsedWeight(initialUsedWeight);
    }
  }, [initialUsedWeight]);

  return (
    <Edit saveButtonProps={saveButtonProps}>
      {contextHolder}
      <Form {...formProps} layout="vertical">
        <Form.Item
          label={t("spool.fields.id")}
          name={["id"]}
          rules={[
            {
              required: true,
            },
          ]}
        >
          <Input readOnly disabled />
        </Form.Item>
        <Form.Item
          label={t("spool.fields.registered")}
          name={["registered"]}
          rules={[
            {
              required: true,
            },
          ]}
          getValueProps={(value) => ({
            value: value ? dayjs(value) : undefined,
          })}
        >
          <DatePicker disabled showTime format="YYYY-MM-DD HH:mm:ss" />
        </Form.Item>
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
        <Form.Item label={t("spool.fields.used_weight")} help={t("spool.fields_help.used_weight")}>
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
        <Form.Item label={t("spool.fields.remaining_weight")} help={t("spool.fields_help.remaining_weight")}>
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
        <Form.Item label={t("spool.fields.measured_weight")} help={t("spool.fields_help.measured_weight")}>
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
      {hasChanged && <Alert description={t("spool.form.spool_updated")} type="warning" showIcon />}
    </Edit>
  );
};

export default SpoolEdit;
