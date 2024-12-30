import { useTranslate } from "@refinedev/core";
import { Button, Checkbox, Form, Input, message } from "antd";
import { useEffect } from "react";
import { useGetSettings, useSetSetting } from "../../utils/querySettings";

export function GeneralSettings() {
  const settings = useGetSettings();
  const setBaseUrl = useSetSetting("base_url");
  const setCurrency = useSetSetting("currency");
  const setRoundPrices = useSetSetting("round_prices");
  const [form] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();
  const t = useTranslate();

  // Set initial form values
  useEffect(() => {
    if (settings.data) {
      form.setFieldsValue({
        currency: JSON.parse(settings.data.currency.value),
        base_url: JSON.parse(settings.data.base_url.value),
        round_prices: JSON.parse(settings.data.round_prices.value),
      });
    }
  }, [settings.data, form]);

  // Popup message if setSetting is successful
  useEffect(() => {
    if (setCurrency.isSuccess) {
      messageApi.success(t("notifications.saveSuccessful"));
    }
  }, [setCurrency.isSuccess, messageApi, t]);

  // Handle form submit
  const onFinish = (values: { currency: string; base_url: string, round_prices: boolean }) => {
    // Check if the currency has changed
    if (settings.data?.currency.value !== JSON.stringify(values.currency)) {
      setCurrency.mutate(values.currency);
    }
    // Check if the base URL has changed
    if (settings.data?.base_url.value !== JSON.stringify(values.base_url)) {
      setBaseUrl.mutate(values.base_url);
    }

    // Check if the setting to round prices has changed
    if (settings.data?.round_prices.value !== JSON.stringify(values.round_prices)) {
      setRoundPrices.mutate(values.round_prices);
    }
  };

  return (
    <>
      <Form
        form={form}
        labelCol={{ span: 8 }}
        wrapperCol={{ span: 16 }}
        initialValues={{
          currency: settings.data?.currency.value,
          round_prices: settings.data?.round_prices.value,
        }}
        onFinish={onFinish}
        style={{
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        <Form.Item
          label={t("settings.general.currency.label")}
          name="currency"
          rules={[
            {
              required: true,
            },
            {
              pattern: /^[A-Z]{3}$/,
            },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          label={t("settings.general.base_url.label")}
          tooltip={t("settings.general.base_url.tooltip")}
          name="base_url"
          rules={[
            {
              required: false,
            },
            {
              pattern: /^https?:\/\/.+(?<!\/)$/,
            },
          ]}
        >
          <Input placeholder="https://example.com:8000" />
        </Form.Item>

        <Form.Item
          label={t("settings.general.round_prices.label")}
          tooltip={t("settings.general.round_prices.tooltip")}
          name="round_prices"
          valuePropName="checked"
        >
          <Checkbox />
        </Form.Item>

        <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
          <Button type="primary" htmlType="submit" loading={settings.isFetching || setCurrency.isLoading}>
            {t("buttons.save")}
          </Button>
        </Form.Item>
      </Form>
      {contextHolder}
    </>
  );
}
