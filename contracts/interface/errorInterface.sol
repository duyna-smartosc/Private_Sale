// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IError {
    error NotOwner();

  error AlreadyParticipant();

  error AlreadyVip();

  error NotParticipant();

  error VipConditionUnsastified();

  error InputInvalid();

  error SaleNotExist();

  error SaleNotInitialized();

  error SaleNotActive();

  error SaleNotCanceled();

  error SaleNotFinalized();

  error SaleNotOver();

  error SaleIsOver();

  error InsufficientSupplyInSale();

}