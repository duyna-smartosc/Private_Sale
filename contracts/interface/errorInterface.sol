// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IError {
  /// @dev Indicates the current caller is not Owner. Used with onlyOwner modifier
  error NotOwner();

  /// @dev Indicates the address is already participant. Used in register
  error AlreadyParticipant();

  /// @dev Indicates the address is already in whitelist. Used in vip
  error AlreadyVip();

  /// @dev Indicates the address is not a participant
  error NotParticipant();

  /// @dev Indicates a failure when registering an address for whitelist
  error VipConditionUnsastified();

  /// @dev Indicates a failure with the parameter passed into the function
  error InputInvalid();

  /// @dev Indicates a sale does not exist
  error SaleNotExist();

  /// @dev Indicates a sale is not in its Initialized state
  error SaleNotInitialized();

  /// @dev Indicates a sale is not in its Active state
  error SaleNotActive();

  /// @dev Indicates a sale is not in its Canceled state
  error SaleNotCanceled();

  /// @dev Indicates a sale is not in its Finalized state
  error SaleNotFinalized();

  /// @dev Indicates a sale is not over
  error SaleNotOver();

  /// @dev Indicates a sale is over
  error SaleIsOver();

  /// @dev Indicates a sale does not have enough supply to sale to user
  error InsufficientSupplyInSale();

}