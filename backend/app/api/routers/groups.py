from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.group import Group, GroupMember
from app.schemas.group import (
    GroupCreate,
    GroupMemberCreate,
    GroupMemberRead,
    GroupRead,
    GroupUpdate,
)

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("", response_model=GroupRead, status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupCreate, db: Session = Depends(get_db)):
    group = Group(**payload.model_dump())
    db.add(group)
    db.commit()
    db.refresh(group)
    if payload.owner_id is not None:
        db.add(GroupMember(group_id=group.id, user_id=payload.owner_id))
        db.commit()
    return group


@router.get("", response_model=list[GroupRead])
def list_groups(user_id: int, db: Session = Depends(get_db)):
    stmt = (
        select(Group)
        .join(GroupMember, Group.id == GroupMember.group_id)
        .where(GroupMember.user_id == user_id)
    )
    return list(db.scalars(stmt))


@router.get("/{group_id}", response_model=GroupRead)
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.put("/{group_id}", response_model=GroupRead)
def update_group(group_id: int, payload: GroupUpdate, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(group, field, value)
    db.commit()
    db.refresh(group)
    return group


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    db.delete(group)
    db.commit()


@router.post("/{group_id}/members", response_model=GroupMemberRead, status_code=status.HTTP_201_CREATED)
def add_member(group_id: int, payload: GroupMemberCreate, db: Session = Depends(get_db)):
    if not db.get(Group, group_id):
        raise HTTPException(status_code=404, detail="Group not found")
    member = GroupMember(group_id=group_id, user_id=payload.user_id)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("/{group_id}/members", response_model=list[GroupMemberRead])
def list_members(group_id: int, db: Session = Depends(get_db)):
    return list(db.scalars(select(GroupMember).where(GroupMember.group_id == group_id)))


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(group_id: int, user_id: int, db: Session = Depends(get_db)):
    member = db.scalar(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user_id)
    )
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    db.delete(member)
    db.commit()
