from __future__ import annotations

from decimal import Decimal
from typing import Any

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from app.core.config import settings


def _resource_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {"region_name": settings.AWS_REGION}
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return kwargs


_dynamodb = boto3.resource("dynamodb", **_resource_kwargs())
_local_tables: dict[str, list[dict[str, Any]]] = {}
_local_sequences: dict[str, int] = {}


def _coerce_id_like(field_name: str, value: Any) -> Any:
    if value is None:
        return None
    if field_name == "id" or field_name.endswith("_id"):
        return str(value)
    return value


def _coerce_item_for_dynamo(item: dict[str, Any]) -> dict[str, Any]:
    return {k: _coerce_id_like(k, v) for k, v in item.items()}


def _coerce_key_for_dynamo(key: dict[str, Any]) -> dict[str, Any]:
    return {k: _coerce_id_like(k, v) for k, v in key.items()}


def _is_local_mode() -> bool:
    return settings.ENVIRONMENT == "local"


def _is_missing_table_error(exc: Exception) -> bool:
    if isinstance(exc, ClientError):
        code = exc.response.get("Error", {}).get("Code", "")
        return code == "ResourceNotFoundException"
    return False


def _key_name_for_item(item: dict[str, Any]) -> str:
    for candidate in ("id", "user_id", "entity"):
        if candidate in item:
            return candidate
    return next(iter(item.keys()))


def _local_upsert(table_name: str, item: dict[str, Any]) -> None:
    rows = _local_tables.setdefault(table_name, [])
    key_name = _key_name_for_item(item)
    key_value = item.get(key_name)
    for idx, row in enumerate(rows):
        if row.get(key_name) == key_value:
            rows[idx] = dict(item)
            return
    rows.append(dict(item))


def table(name: str):
    return _dynamodb.Table(name)


def next_id(entity: str) -> int:
    if _is_local_mode():
        current = _local_sequences.get(entity, 0) + 1
        _local_sequences[entity] = current
        return current

    meta = table(settings.META_TABLE)
    try:
        res = meta.update_item(
            Key={"entity": entity},
            UpdateExpression="ADD seq :inc",
            ExpressionAttributeValues={":inc": 1},
            ReturnValues="UPDATED_NEW",
        )
    except Exception as exc:
        if _is_missing_table_error(exc):
            current = _local_sequences.get(entity, 0) + 1
            _local_sequences[entity] = current
            return current
        raise
    value = res["Attributes"]["seq"]
    if isinstance(value, Decimal):
        return int(value)
    return int(value)


def normalize(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if item is None:
        return None
    out: dict[str, Any] = {}
    for k, v in item.items():
        if isinstance(v, Decimal):
            out[k] = int(v) if v % 1 == 0 else float(v)
        else:
            out[k] = v
    return out


def put_item(table_name: str, item: dict[str, Any]) -> None:
    normalized_item = _coerce_item_for_dynamo(item)
    if _is_local_mode():
        _local_upsert(table_name, normalized_item)
        return
    try:
        table(table_name).put_item(Item=normalized_item)
    except Exception as exc:
        if _is_missing_table_error(exc):
            _local_upsert(table_name, normalized_item)
            return
        raise


def get_item(table_name: str, key: dict[str, Any]) -> dict[str, Any] | None:
    normalized_key = _coerce_key_for_dynamo(key)
    if _is_local_mode():
        for row in _local_tables.get(table_name, []):
            if all(row.get(k) == v for k, v in normalized_key.items()):
                return normalize(row)
        return None
    try:
        res = table(table_name).get_item(Key=normalized_key)
        return normalize(res.get("Item"))
    except Exception as exc:
        if _is_missing_table_error(exc):
            for row in _local_tables.get(table_name, []):
                if all(row.get(k) == v for k, v in normalized_key.items()):
                    return normalize(row)
            return None
        raise


def delete_item(table_name: str, key: dict[str, Any]) -> None:
    normalized_key = _coerce_key_for_dynamo(key)
    if _is_local_mode():
        rows = _local_tables.get(table_name, [])
        _local_tables[table_name] = [row for row in rows if not all(row.get(k) == v for k, v in normalized_key.items())]
        return
    try:
        table(table_name).delete_item(Key=normalized_key)
    except Exception as exc:
        if _is_missing_table_error(exc):
            rows = _local_tables.get(table_name, [])
            _local_tables[table_name] = [row for row in rows if not all(row.get(k) == v for k, v in normalized_key.items())]
            return
        raise


def query_gsi(
    table_name: str,
    index_name: str,
    key_name: str,
    key_value: Any,
) -> list[dict[str, Any]]:
    normalized_key_value = _coerce_id_like(key_name, key_value)
    if _is_local_mode():
        return [normalize(x) for x in _local_tables.get(table_name, []) if x.get(key_name) == normalized_key_value]
    try:
        res = table(table_name).query(
            IndexName=index_name,
            KeyConditionExpression=Key(key_name).eq(normalized_key_value),
        )
        return [normalize(x) for x in res.get("Items", []) if normalize(x) is not None]
    except Exception as exc:
        if _is_missing_table_error(exc):
            return [normalize(x) for x in _local_tables.get(table_name, []) if x.get(key_name) == normalized_key_value]
        raise


def scan_all(table_name: str) -> list[dict[str, Any]]:
    if _is_local_mode():
        return [normalize(x) for x in _local_tables.get(table_name, []) if normalize(x) is not None]

    tbl = table(table_name)
    try:
        response = tbl.scan()
        items = response.get("Items", [])
        while "LastEvaluatedKey" in response:
            response = tbl.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
            items.extend(response.get("Items", []))
        return [normalize(x) for x in items if normalize(x) is not None]
    except Exception as exc:
        if _is_missing_table_error(exc):
            return [normalize(x) for x in _local_tables.get(table_name, []) if normalize(x) is not None]
        raise
